import type { JSONObject } from "kuzzle-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NativeController } from "../../../lib/api/controllers/baseController";
import RoleRepository from "../../../lib/core/security/roleRepository";
import { ObjectRepository } from "../../../lib/core/shared/ObjectRepository";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { NotFoundError } from "../../../lib/kerror/errors/notFoundError";
import { PreconditionError } from "../../../lib/kerror/errors/preconditionError";
import kuzzleStateEnum from "../../../lib/kuzzle/kuzzleStateEnum";
import { Role } from "../../../lib/model/security/role";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubAsk, stubKuzzle } from "../../mocks/kuzzle";

/**
 * `_kuzzle_info` is written by `_createOrReplace` and `update` and read back by
 * their specs, but `Role` does not declare it: the metadata rides on the DTO
 * and the model never names it. The alias is what the assertions need, kept
 * here so each one does not repeat the cast.
 */
type RoleWithMeta = Role & {
  _kuzzle_info: {
    author?: string | null;
    createdAt?: number | null;
    updatedAt?: number | null;
    updater?: string | null;
  };
};

/** A `kuzzle-logger` whose `child()` answers the same spied instance. */
function stubLogger() {
  const logger = {
    child: () => logger,
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
  };

  return logger;
}

/** A role with an `_id`, which the constructor deliberately leaves unset. */
function roleNamed(id: string, controllers: Role["controllers"] = {}): Role {
  const role = new Role();

  role._id = id;
  role.controllers = controllers;

  return role;
}

describe("#core/security/RoleRepository", () => {
  let repository: RoleRepository;
  let profile: { search: ReturnType<typeof vi.fn> };
  let bus: ReturnType<typeof stubAsk>;
  let logger: ReturnType<typeof stubLogger>;
  let controllers: Map<string, NativeController>;
  let pluginsManager: {
    getActions: ReturnType<typeof vi.fn>;
    getControllerNames: ReturnType<typeof vi.fn>;
    isAction: ReturnType<typeof vi.fn>;
    isController: ReturnType<typeof vi.fn>;
    plugins: JSONObject;
  };
  let kuzzle: JSONObject;
  let fakeRole: Role;

  beforeEach(() => {
    fakeRole = roleNamed("foo");

    profile = { search: vi.fn(async () => ({ hits: [], total: 0 })) };

    /*
     * The cache events `ObjectRepository` asks on the way in and out. A role
     * is never read from the cache by these specs, so answering `undefined` is
     * the whole dependency — anything else the subject grows to ask throws,
     * which is the point of the fallback.
     */
    bus = stubAsk(() => undefined);

    controllers = new Map();
    logger = stubLogger();

    pluginsManager = {
      getActions: vi.fn(() => []),
      getControllerNames: vi.fn(() => []),
      isAction: vi.fn(() => true),
      isController: vi.fn(() => true),
      plugins: {},
    };

    kuzzle = stubKuzzle({
      ask: bus.ask,
      config: { repositories: { common: { cacheTTL: 1440000 } } },
      funnel: {
        controllers,
        isNativeController: vi.fn((ctrl: string) => controllers.has(ctrl)),
      },
      internalIndex: {
        create: vi.fn(),
        createOrReplace: vi.fn(),
        delete: vi.fn(),
        get: vi.fn(),
        index: "%kuzzle",
        replace: vi.fn(),
        search: vi.fn(),
        update: vi.fn(),
      },
      log: logger,
      onAsk: bus.onAsk,
      // `NativeController`'s constructor binds both, and #checkRoleNativeRights
      // builds real ones to ask them which actions they own.
      pipe: vi.fn(),
      pluginsManager,
      state: kuzzleStateEnum.RUNNING,
    });

    /* The security module's interface is declared inside the subject's own
     * file and not exported; its constructor is what names it. */
    repository = new RoleRepository(
      invalid<ConstructorParameters<typeof RoleRepository>[0]>({ profile }),
    );

    repository.init();
  });

  afterEach(() => {
    restoreKuzzle();
    vi.restoreAllMocks();
  });

  describe("#loadOneFromDatabase", () => {
    let superLoad: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      superLoad = vi.spyOn(ObjectRepository.prototype, "loadOneFromDatabase");
    });

    it("should invoke its super function", async () => {
      superLoad.mockResolvedValue(fakeRole);

      await expect(repository.loadOneFromDatabase("bar")).resolves.toBe(
        fakeRole,
      );

      expect(superLoad).toHaveBeenCalledWith("bar");
    });

    it("should wrap generic 404s into role dedicated errors", async () => {
      const error = Object.assign(new Error("foo"), { status: 404 });

      superLoad.mockRejectedValue(error);

      const rejection = repository.loadOneFromDatabase("foo");

      await expect(rejection).rejects.toBeInstanceOf(NotFoundError);
      await expect(rejection).rejects.toMatchObject({
        id: "security.role.not_found",
      });
    });

    it("should re-throw non-404 errors as is", async () => {
      const error = new Error("foo");

      superLoad.mockRejectedValue(error);

      await expect(repository.loadOneFromDatabase("foo")).rejects.toBe(error);
    });
  });

  describe("#mGet", () => {
    it("should register a mGet event", async () => {
      const loadRoles = vi
        .spyOn(repository, "loadRoles")
        .mockResolvedValue([fakeRole]);

      await bus.ask("core:security:role:mGet", ["foo"]);

      expect(loadRoles).toHaveBeenCalledWith(["foo"]);
    });

    it("should return in memory roles", async () => {
      const fromDatabase = vi.spyOn(repository, "loadOneFromDatabase");

      repository.roles.set(fakeRole._id, fakeRole);

      await expect(repository.loadRoles([fakeRole._id])).resolves.toEqual([
        fakeRole,
      ]);

      expect(fromDatabase).not.toHaveBeenCalled();
    });

    it("should load roles from memory & database", async () => {
      const role1 = roleNamed("role1");
      const role2 = roleNamed("role2");
      const role3 = roleNamed("role3");
      const role4 = roleNamed("role4");

      repository.roles.set("role3", role3);

      const fromDatabase = vi
        .spyOn(repository, "loadOneFromDatabase")
        .mockImplementation(async (id: string) => {
          const role = { role1, role2, role4 }[id as "role1"];

          if (role === undefined) {
            throw new Error(`unexpected loadOneFromDatabase("${id}")`);
          }

          return role;
        });

      await expect(
        repository.loadRoles(["role1", "role2", "role3", "role4"]),
      ).resolves.toEqual([role1, role2, role3, role4]);

      expect(fromDatabase).toHaveBeenCalledWith("role1");
      expect(fromDatabase).toHaveBeenCalledWith("role2");
      expect(fromDatabase).not.toHaveBeenCalledWith("role3");
      expect(fromDatabase).toHaveBeenCalledWith("role4");
    });
  });

  describe("#get", () => {
    it('should register a "get" event', async () => {
      const load = vi.spyOn(repository, "load").mockResolvedValue(fakeRole);

      await bus.ask("core:security:role:get", "foo");

      expect(load).toHaveBeenCalledWith("foo");
    });

    it("should load the role directly from the cache, if present", async () => {
      const fromDatabase = vi.spyOn(repository, "loadOneFromDatabase");

      repository.roles.set(fakeRole._id, fakeRole);

      await expect(repository.load(fakeRole._id)).resolves.toBe(fakeRole);

      expect(fromDatabase).not.toHaveBeenCalled();
    });

    it("should load the role directly from DB if it is not in memory", async () => {
      vi.spyOn(repository, "loadOneFromDatabase").mockResolvedValue(fakeRole);

      await expect(repository.load(fakeRole._id)).resolves.toBe(fakeRole);

      // `should(...).have.key(id, role)` ignored its second argument, so the
      // Mocha spec only ever asserted the key was there, never the role.
      expect(repository.roles.get(fakeRole._id)).toBe(fakeRole);
    });
  });

  describe("#search", () => {
    it('should register a "search" event', async () => {
      const searchRole = vi
        .spyOn(repository, "searchRole")
        .mockResolvedValue({ hits: [], total: 0 });

      await bus.ask("core:security:role:search", "foo", "bar");

      expect(searchRole).toHaveBeenCalledWith("foo", "bar");
    });

    it("should filter the role list with the given controllers", async () => {
      const roles = {
        bar: { _id: "bar", controllers: { bar: { actions: { "*": true } } } },
        default: {
          _id: "default",
          controllers: { "*": { actions: { "*": true } } },
        },
        foo: { _id: "foo", controllers: { foo: { actions: { "*": true } } } },
        foobar: {
          _id: "foobar",
          controllers: {
            bar: { actions: { "*": true } },
            foo: { actions: { "*": true } },
          },
        },
      };

      vi.spyOn(repository, "search").mockResolvedValue(
        invalid<Awaited<ReturnType<typeof repository.search>>>({
          hits: [roles.default, roles.foo, roles.bar, roles.foobar],
          total: 4,
        }),
      );

      await expect(
        repository.searchRole({ controllers: ["foo"] }),
      ).resolves.toMatchObject({
        hits: [roles.default, roles.foo, roles.foobar],
        total: 3,
      });

      await expect(
        repository.searchRole({ controllers: ["bar"] }),
      ).resolves.toMatchObject({
        hits: [roles.default, roles.bar, roles.foobar],
        total: 3,
      });

      await expect(
        repository.searchRole({ controllers: ["foo", "bar"] }),
      ).resolves.toMatchObject({
        hits: [roles.default, roles.foo, roles.bar, roles.foobar],
        total: 4,
      });

      await expect(
        repository.searchRole({ controllers: ["baz"] }),
      ).resolves.toMatchObject({ hits: [roles.default], total: 1 });

      // `from` and `size` slice the filtered hits, but `total` stays the
      // unpaginated count.
      await expect(
        repository.searchRole({ controllers: ["foo"] }, { from: 1 }),
      ).resolves.toMatchObject({
        hits: [roles.foo, roles.foobar],
        total: 3,
      });

      await expect(
        repository.searchRole({ controllers: ["foo"] }, { size: 2 }),
      ).resolves.toMatchObject({
        hits: [roles.default, roles.foo],
        total: 3,
      });

      await expect(
        repository.searchRole(
          { controllers: ["foo", "bar"] },
          { from: 1, size: 2 },
        ),
      ).resolves.toMatchObject({
        hits: [roles.foo, roles.bar],
        total: 4,
      });
    });

    it("should pass the query to the search method", async () => {
      const search = vi.spyOn(repository, "search").mockResolvedValue(
        invalid<Awaited<ReturnType<typeof repository.search>>>({
          hits: [],
          total: 0,
        }),
      );

      await repository.searchRole({ query: { term: {} } });

      expect(search).toHaveBeenCalledWith(
        { query: { term: {} } },
        { from: 0, size: 9999 },
      );
    });
  });

  describe("#delete", () => {
    let deleteFromDatabase: ReturnType<typeof vi.spyOn>;
    let load: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      deleteFromDatabase = vi
        .spyOn(repository, "deleteFromDatabase")
        .mockResolvedValue(undefined);

      load = vi.spyOn(repository, "load").mockImplementation(async (id) => {
        if (id === fakeRole._id) {
          return fakeRole;
        }

        throw new Error(`unexpected load("${id}")`);
      });
    });

    it('should register a "delete" event', async () => {
      const deleteById = vi
        .spyOn(repository, "deleteById")
        .mockResolvedValue(undefined);

      await bus.ask("core:security:role:delete", "foo", "bar");

      expect(deleteById).toHaveBeenCalledWith("foo", "bar");
    });

    it("should reject if trying to delete a reserved role", async () => {
      for (const id of ["admin", "default", "anonymous"]) {
        load.mockResolvedValue(roleNamed(id));

        const rejection = repository.deleteById(id);

        await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
        await expect(rejection).rejects.toMatchObject({
          id: "security.role.cannot_delete",
        });

        // The Mocha spec asserted `kuzzle.emit` was not called; the subject
        // never emits on this path, so that could not have failed. What it
        // owes is that the refusal happens before anything is looked up.
        expect(profile.search).not.toHaveBeenCalled();
        expect(deleteFromDatabase).not.toHaveBeenCalled();
      }
    });

    it("should reject if a profile uses the role about to be deleted", async () => {
      profile.search.mockResolvedValue({ hits: [fakeRole._id], total: 1 });

      const rejection = repository.deleteById(fakeRole._id);

      await expect(rejection).rejects.toBeInstanceOf(PreconditionError);
      await expect(rejection).rejects.toMatchObject({
        id: "security.role.in_use",
      });

      expect(profile.search).toHaveBeenCalledWith(
        { query: { term: { "policies.roleId": fakeRole._id } } },
        { from: 0, size: 1 },
      );
      expect(deleteFromDatabase).not.toHaveBeenCalled();
    });

    it("should call thoroughly delete a role", async () => {
      repository.roles.set(fakeRole._id, fakeRole);

      await repository.deleteById(fakeRole._id);

      expect(deleteFromDatabase).toHaveBeenCalledOnce();
      expect(deleteFromDatabase).toHaveBeenCalledWith(fakeRole._id, {
        refresh: "false",
      });
      expect(repository.roles.has(fakeRole._id)).toBe(false);
    });

    it("should reject if the role to delete cannot be loaded", async () => {
      const error = new Error("foo");

      load.mockRejectedValue(error);

      await expect(repository.deleteById(fakeRole._id)).rejects.toBe(error);
    });
  });

  describe("#serializeToDatabase", () => {
    it("should return a plain flat object", () => {
      const controllerRights = { controller: { actions: { action: true } } };

      fakeRole.controllers = controllerRights;
      invalid<{ restrictedTo: unknown }>(fakeRole).restrictedTo = ["nope"];

      const result = repository.serializeToDatabase(fakeRole);

      expect(result).not.toBeInstanceOf(Role);
      expect(result.controllers).toEqual(controllerRights);
      expect(result).not.toHaveProperty("_id");
      expect(result).not.toHaveProperty("restrictedTo");
    });
  });

  describe("#validateAndSaveRole", () => {
    it("should throw if we update the anonymous with a role it cannot log with - case 1", async () => {
      const role = roleNamed("anonymous", {
        controller: { actions: { action: true } },
      });

      const rejection = repository.validateAndSaveRole(role);

      await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection).rejects.toMatchObject({
        id: "security.role.login_required",
      });
    });

    it("should throw if we update the anonymous with a role it cannot log with - case 2", async () => {
      const role = roleNamed("anonymous", { "*": { actions: { "*": false } } });

      const rejection = repository.validateAndSaveRole(role);

      await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection).rejects.toMatchObject({
        id: "security.role.login_required",
      });
    });

    it("should throw if we update the anonymous with a role it cannot log with - case 3", async () => {
      const role = roleNamed("anonymous", {
        auth: { actions: { login: false } },
      });

      const rejection = repository.validateAndSaveRole(role);

      await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection).rejects.toMatchObject({
        id: "security.role.login_required",
      });
    });

    it("should allow updating the anonymous as long as it can log in", async () => {
      const role = roleNamed("anonymous", {
        "*": { actions: { login: true } },
      });

      vi.spyOn(repository, "loadOneFromDatabase").mockResolvedValue(role);
      vi.spyOn(repository, "persistToDatabase").mockResolvedValue(undefined);

      // The Mocha spec stubbed both checks with `.resolves()`, on two methods
      // that are synchronous and return nothing.
      const native = vi
        .spyOn(repository, "checkRoleNativeRights")
        .mockReturnValue(undefined);
      const plugins = vi
        .spyOn(repository, "checkRolePluginsRights")
        .mockReturnValue(undefined);

      await expect(repository.validateAndSaveRole(role)).resolves.toBe(role);

      expect(native).toHaveBeenCalledWith(role);
      expect(plugins).toHaveBeenCalledWith(role, {});
    });

    it("should correctly persist the role", async () => {
      const role = roleNamed("test", {
        controller: { actions: { action: true } },
      });

      vi.spyOn(repository, "checkRoleNativeRights").mockReturnValue(undefined);
      vi.spyOn(repository, "checkRolePluginsRights").mockReturnValue(undefined);
      vi.spyOn(repository, "loadOneFromDatabase").mockResolvedValue(role);

      const persist = vi
        .spyOn(repository, "persistToDatabase")
        .mockResolvedValue(undefined);

      await repository.validateAndSaveRole(role);

      expect(persist).toHaveBeenCalledOnce();
      expect(persist).toHaveBeenCalledWith(role, {});
      expect(repository.roles.get(role._id)).toBe(role);
    });
  });

  describe("#checkRoleNativeRights", () => {
    beforeEach(() => {
      controllers.set("document", new NativeController(["create", "delete"]));
    });

    it("should skip if the tested role does not concern native controllers", () => {
      const role = roleNamed("test", invalid({ foo: "trolololo" }));

      expect(() => repository.checkRoleNativeRights(role)).not.toThrow();
    });

    it("should throw if a role contains an unknown action", () => {
      const role = roleNamed("test", {
        document: {
          actions: { create: true, delete: false, iDontExist: true },
        },
      });

      expect(() => repository.checkRoleNativeRights(role)).toThrowError(
        expect.objectContaining({ id: "security.role.unknown_action" }),
      );
    });

    it("should validate if a role contains known actions", () => {
      const role = roleNamed("test", {
        document: { actions: { create: true, delete: false } },
      });

      expect(() => repository.checkRoleNativeRights(role)).not.toThrow();
    });

    it("should validate if a role contains a wildcarded action", () => {
      const role = roleNamed("test", {
        document: { actions: { "*": true, create: true, delete: false } },
      });

      expect(() => repository.checkRoleNativeRights(role)).not.toThrow();
    });

    it("should validate if a wildcarded role contains specific actions", () => {
      const role = roleNamed("test", {
        "*": { actions: { "*": true, create: true, delete: false } },
      });

      expect(() => repository.checkRoleNativeRights(role)).toThrowError(
        expect.objectContaining({ id: "security.role.unknown_action" }),
      );
    });
  });

  describe("#checkRolePluginsRights", () => {
    beforeEach(() => {
      pluginsManager.plugins = {
        plugin_test: {
          object: { controllers: { foobar: { publicMethod: "function" } } },
        },
      };
    });

    it("should skip non-plugins or wildcarded controllers", () => {
      pluginsManager.isController.mockReturnValue(false);

      const wildcarded = roleNamed("test", invalid({ "*": 123 }));

      repository.checkRolePluginsRights(wildcarded);

      const native = roleNamed("test", invalid({ foo: 0 }));

      controllers.set("foo", new NativeController([]));

      repository.checkRolePluginsRights(native);

      // Neither role reached the plugin lookup, which is the whole claim.
      expect(pluginsManager.isController).not.toHaveBeenCalled();
    });

    it("should warn if we force a role having an invalid plugin controller.", () => {
      pluginsManager.isController.mockReturnValue(false);

      const role = roleNamed("test", {
        invalid_controller: { actions: { publicMethod: true } },
      });

      repository.checkRolePluginsRights(role, { force: true });

      expect(logger.warn).toHaveBeenCalledWith(
        'The role "test" gives access to the non-existing controller "invalid_controller".',
      );
    });

    it("should warn if kuzzle is not started and forceWarn is set", () => {
      kuzzle.state = kuzzleStateEnum.STARTING;
      pluginsManager.isController.mockReturnValue(false);

      const role = roleNamed("test", {
        invalid_controller: { actions: { publicMethod: true } },
      });

      repository.checkRolePluginsRights(role, { force: true, forceWarn: true });

      expect(logger.warn).toHaveBeenCalledWith(
        'The role "test" gives access to the non-existing controller "invalid_controller".',
      );
    });

    it("should throw if we try to write a role with an invalid plugin controller.", () => {
      pluginsManager.isController.mockReturnValue(false);
      pluginsManager.getControllerNames.mockReturnValue(["foobar"]);

      const role = roleNamed("test", {
        invalid_controller: { actions: { publicMethod: true } },
      });

      expect(() => repository.checkRolePluginsRights(role)).toThrowError(
        expect.objectContaining({ id: "security.role.unknown_controller" }),
      );
    });

    it("should warn if we force a role having an invalid plugin action.", () => {
      pluginsManager.isController.mockReturnValue(true);
      pluginsManager.isAction.mockReturnValue(false);

      const role = roleNamed("test", {
        foobar: { actions: { iDontExist: true } },
      });

      repository.checkRolePluginsRights(role, { force: true });

      expect(logger.warn).toHaveBeenCalledWith(
        'The role "test" gives access to the non-existing action "iDontExist" for the controller "foobar".',
      );
    });

    it("should throw if we try to write a role with an invalid plugin action.", () => {
      pluginsManager.isController.mockReturnValue(true);
      pluginsManager.isAction.mockReturnValue(false);
      pluginsManager.getActions.mockReturnValue(["foobar"]);

      const role = roleNamed("test", {
        foobar: { actions: { iDontExist: true } },
      });

      expect(() => repository.checkRolePluginsRights(role)).toThrowError(
        expect.objectContaining({ id: "security.role.unknown_action" }),
      );
    });

    it("should not warn nor throw when a role contains valid controller and action.", () => {
      pluginsManager.isController.mockReturnValue(true);
      pluginsManager.isAction.mockReturnValue(true);

      const role = roleNamed("test", {
        foobar: { actions: { publicMethod: true } },
      });

      expect(() => repository.checkRolePluginsRights(role)).not.toThrow();

      // The Mocha spec watched `kuzzle.log.warn`; the subject warns through
      // `log.child(...)`, so that assertion was on an object it never touches.
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("should throw on an unknown plugin action, if not forced", () => {
      /*
       * The Mocha spec declared this one with an empty body. What the case
       * above leaves unsaid is the suggestion the error carries — and
       * `didYouMean` returns "" unless `global.NODE_ENV` is "development", so
       * no spec in either suite had ever reached that branch.
       */
      const nodeEnv = global.NODE_ENV;

      global.NODE_ENV = "development";

      try {
        pluginsManager.isController.mockReturnValue(true);
        pluginsManager.isAction.mockReturnValue(false);
        pluginsManager.getActions.mockReturnValue(["publicMethod"]);

        const role = roleNamed("test", {
          foobar: { actions: { publicMethdo: true } },
        });

        expect(() => repository.checkRolePluginsRights(role)).toThrowError(
          /Did you mean "publicMethod"\?/,
        );

        expect(pluginsManager.getActions).toHaveBeenCalledWith("foobar");
      } finally {
        global.NODE_ENV = nodeEnv;
      }
    });
  });

  describe("#create", () => {
    let validateAndSaveRole: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      validateAndSaveRole = vi
        .spyOn(repository, "validateAndSaveRole")
        .mockResolvedValue(fakeRole);
    });

    it('should register a "create" event', async () => {
      const create = vi.spyOn(repository, "create").mockResolvedValue(fakeRole);

      await bus.ask("core:security:role:create", "foo", "bar", "baz");

      expect(create).toHaveBeenCalledWith("foo", "bar", "baz");
    });

    it("should pass the right configuration to validateAndSaveRole", async () => {
      await repository.create(
        "foobar",
        { _id: "ohnoes", _kuzzle_info: "nope", bar: "bar", foo: "foo" },
        { refresh: "refresh", userId: "userId" },
      );

      expect(validateAndSaveRole).toHaveBeenCalledWith(expect.any(Role), {
        force: false,
        method: "create",
        refresh: "refresh",
      });

      const role = validateAndSaveRole.mock.calls[0][0] as RoleWithMeta;

      expect(role._id).toBe("foobar");
      expect(role).toMatchObject({ bar: "bar", foo: "foo" });
      expect(role._kuzzle_info).toMatchObject({
        author: "userId",
        updatedAt: null,
        updater: null,
      });
      expect(role._kuzzle_info.createdAt).toBeCloseTo(Date.now(), -3);
    });

    it("should resolve to the validateAndSaveRole result", async () => {
      validateAndSaveRole.mockResolvedValue(fakeRole);

      await expect(repository.create("foo", {}, {})).resolves.toBe(fakeRole);
    });
  });

  describe("#createOrReplace", () => {
    let validateAndSaveRole: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      validateAndSaveRole = vi
        .spyOn(repository, "validateAndSaveRole")
        .mockResolvedValue(fakeRole);
    });

    it('should register a "createOrReplace" event', async () => {
      const createOrReplace = vi
        .spyOn(repository, "createOrReplace")
        .mockResolvedValue(fakeRole);

      await bus.ask("core:security:role:createOrReplace", "foo", "bar", "baz");

      expect(createOrReplace).toHaveBeenCalledWith("foo", "bar", "baz");
    });

    it("should pass the right configuration to validateAndSaveRole", async () => {
      await repository.createOrReplace(
        "foobar",
        { _id: "ohnoes", _kuzzle_info: "nope", bar: "bar", foo: "foo" },
        { refresh: "refresh", userId: "userId" },
      );

      expect(validateAndSaveRole).toHaveBeenCalledWith(expect.any(Role), {
        force: false,
        method: "createOrReplace",
        refresh: "refresh",
      });

      const role = validateAndSaveRole.mock.calls[0][0] as RoleWithMeta;

      expect(role._id).toBe("foobar");
      expect(role).toMatchObject({ bar: "bar", foo: "foo" });
      expect(role._kuzzle_info).toMatchObject({
        author: "userId",
        updatedAt: null,
        updater: null,
      });
      expect(role._kuzzle_info.createdAt).toBeCloseTo(Date.now(), -3);
    });

    it("should resolve to the validateAndSaveRole result", async () => {
      validateAndSaveRole.mockResolvedValue(fakeRole);

      await expect(repository.createOrReplace("foo", {}, {})).resolves.toBe(
        fakeRole,
      );
    });
  });

  describe("#truncate", () => {
    let superTruncate: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      superTruncate = vi
        .spyOn(ObjectRepository.prototype, "truncate")
        .mockResolvedValue(0);
    });

    it('should register a "truncate" event', async () => {
      const truncate = vi.spyOn(repository, "truncate").mockResolvedValue(0);

      await bus.ask("core:security:role:truncate", "foo");

      expect(truncate).toHaveBeenCalledWith("foo");
    });

    it("should clear the RAM cache once the truncate succeeds", async () => {
      const opts = { foo: "bar" };

      repository.roles.set("foo", roleNamed("foo"));
      repository.roles.set("baz", roleNamed("baz"));

      await repository.truncate(opts);

      expect(superTruncate).toHaveBeenCalledWith(opts);
      expect(repository.roles.size).toBe(0);
    });

    it("should answer the count of deleted roles", async () => {
      // The override used to await the base and return undefined, so
      // admin:resetSecurity reported `deletedRoles: undefined`.
      superTruncate.mockResolvedValue(3);

      await expect(repository.truncate({})).resolves.toBe(3);
    });

    it("should clear the RAM cache even if the truncate fails", async () => {
      const error = new Error("foo");

      superTruncate.mockRejectedValue(error);

      repository.roles.set("foo", roleNamed("foo"));
      repository.roles.set("baz", roleNamed("baz"));

      await expect(repository.truncate({})).rejects.toBe(error);

      expect(repository.roles.size).toBe(0);
    });
  });

  describe("#update", () => {
    let validateAndSaveRole: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      validateAndSaveRole = vi
        .spyOn(repository, "validateAndSaveRole")
        .mockResolvedValue(fakeRole);
    });

    it('should register a "update" event', async () => {
      const update = vi.spyOn(repository, "update").mockResolvedValue(fakeRole);

      await bus.ask("core:security:role:update", "foo", "bar", "baz");

      expect(update).toHaveBeenCalledWith("foo", "bar", "baz");
    });

    it("should pass the right configuration to validateAndSaveRole", async () => {
      await repository.update(
        "foobar",
        { _id: "ohnoes", _kuzzle_info: "nope", bar: "bar", foo: "foo" },
        { refresh: "refresh", userId: "userId" },
      );

      expect(validateAndSaveRole).toHaveBeenCalledWith(expect.any(Role), {
        method: "replace",
        refresh: "refresh",
      });

      const role = validateAndSaveRole.mock.calls[0][0] as RoleWithMeta;

      expect(role._id).toBe("foobar");
      expect(role).toMatchObject({ bar: "bar", foo: "foo" });
      expect(role._kuzzle_info).toMatchObject({ updater: "userId" });
      expect(role._kuzzle_info.updatedAt).toBeCloseTo(Date.now(), -3);
    });

    it("should resolve to the validateAndSaveRole result", async () => {
      validateAndSaveRole.mockResolvedValue(fakeRole);

      await expect(repository.update("foo", {}, {})).resolves.toBe(fakeRole);
    });
  });

  describe("#sanityCheck", () => {
    it('should register a "verify" event', async () => {
      const sanityCheck = vi
        .spyOn(repository, "sanityCheck")
        .mockResolvedValue(undefined);

      await bus.ask("core:security:verify");

      expect(sanityCheck).toHaveBeenCalledOnce();
    });

    it("should perform a check on all plugin roles", async () => {
      const role1 = roleNamed("role1");
      const role2 = roleNamed("role2");
      const role3 = roleNamed("role3");

      vi.spyOn(repository, "search").mockResolvedValue(
        invalid<Awaited<ReturnType<typeof repository.search>>>({
          hits: [role1, role2, role3],
          total: 3,
        }),
      );

      const check = vi
        .spyOn(repository, "checkRolePluginsRights")
        .mockReturnValue(undefined);

      await repository.sanityCheck();

      for (const role of [role1, role2, role3]) {
        expect(check).toHaveBeenCalledWith(role, {
          force: true,
          forceWarn: true,
        });
      }
    });
  });

  describe("#invalidate", () => {
    it('should register an "invalidate" event', async () => {
      const invalidate = vi
        .spyOn(repository, "invalidate")
        .mockReturnValue(undefined);

      await bus.ask("core:security:role:invalidate", "foo");

      expect(invalidate).toHaveBeenCalledWith("foo");
    });

    it("should invalidate only the provided role", () => {
      repository.roles.set("foo", roleNamed("foo"));
      repository.roles.set("baz", roleNamed("baz"));

      repository.invalidate("baz");

      expect(repository.roles.has("foo")).toBe(true);
      expect(repository.roles.has("baz")).toBe(false);
    });

    it("should invalidate the entire cache with no argument", () => {
      repository.roles.set("foo", roleNamed("foo"));
      repository.roles.set("baz", roleNamed("baz"));

      repository.invalidate();

      expect(repository.roles.size).toBe(0);
    });
  });
});
