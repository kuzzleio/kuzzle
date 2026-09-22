import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import UserRepository from "../../../lib/core/security/userRepository";
import { ObjectRepository } from "../../../lib/core/shared/ObjectRepository";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { InternalError } from "../../../lib/kerror/errors/internalError";
import { NotFoundError } from "../../../lib/kerror/errors/notFoundError";
import { PreconditionError } from "../../../lib/kerror/errors/preconditionError";
import ApiKey from "../../../lib/model/storage/apiKey";
import { User } from "../../../lib/model/security/user";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubAsk, stubKuzzle } from "../../mocks/kuzzle";

/** What every path that answers "the anonymous user" must answer. */
const expectAnonymous = (user: unknown) => {
  expect(user).toBeInstanceOf(User);
  expect(user).toMatchObject({
    _id: "-1",
    name: "Anonymous",
    profileIds: ["anonymous"],
  });
};

describe("#core/security/UserRepository", () => {
  let repository: UserRepository;
  let profile: { loadProfiles: ReturnType<typeof vi.fn> };
  let token: { deleteByKuid: ReturnType<typeof vi.fn> };
  let listStrategies: ReturnType<typeof vi.fn>;
  let getStrategyMethod: ReturnType<typeof vi.fn>;
  let bus: ReturnType<typeof stubAsk>;

  beforeEach(async () => {
    profile = {
      loadProfiles: vi.fn(async (ids: string[]) =>
        ids.map((id) => ({ _id: id })),
      ),
    };
    token = { deleteByKuid: vi.fn(async () => undefined) };
    listStrategies = vi.fn(() => []);
    getStrategyMethod = vi.fn();

    bus = stubAsk(() => undefined);

    stubKuzzle({
      ask: bus.ask,
      onAsk: bus.onAsk,
      config: { repositories: { common: { cacheTTL: 1440000 } } },
      internalIndex: { index: "%kuzzle" },
      pluginsManager: { getStrategyMethod, listStrategies },
    });

    repository = new UserRepository(
      invalid<ConstructorParameters<typeof UserRepository>[0]>({
        profile,
        token,
      }),
    );

    await repository.init();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreKuzzle();
  });

  const ask = (event: string, ...args: unknown[]) =>
    global.kuzzle.ask(event, ...args);

  describe("#init", () => {
    /* One test per registration; see ProfileRepository's spec for why. */
    it.each([
      [
        "core:security:user:create",
        "create",
        ["id", "profiles", "content", "opts"],
      ],
      ["core:security:user:delete", "deleteById", ["foo", "bar"]],
      ["core:security:user:get", "load", ["foo"]],
      ["core:security:user:mGet", "loadMultiFromDatabase", ["foo"]],
      [
        "core:security:user:replace",
        "replace",
        ["id", "profiles", "content", "opts"],
      ],
      ["core:security:user:scroll", "scroll", ["foo", "bar"]],
      ["core:security:user:search", "search", ["foo", "bar"]],
      ["core:security:user:truncate", "truncate", ["foo"]],
      [
        "core:security:user:update",
        "update",
        ["id", "profiles", "content", "opts"],
      ],
      ["core:security:user:admin:exist", "adminExists", []],
    ])("should answer %s with %s()", async (event, method, args) => {
      const spy = invalid<ReturnType<typeof vi.fn>>(
        vi.spyOn(repository, method as never),
      );
      spy.mockResolvedValue(undefined);

      await ask(event, ...args);

      expect(spy).toHaveBeenCalledWith(...args);
    });

    it("should answer core:security:user:anonymous:get with the anonymous user", async () => {
      expectAnonymous(await ask("core:security:user:anonymous:get"));
    });
  });

  describe("#fromDTO", () => {
    it("should return the anonymous user if no _id is set", async () => {
      expectAnonymous(await repository.fromDTO({ profileIds: "a profile" }));
    });

    it("should convert a profileIds string into an array", async () => {
      const user = await repository.fromDTO({
        _id: "admin",
        profileIds: "admin",
      });

      expect(user.profileIds).toEqual(["admin"]);
    });

    it("should reject if a profile cannot be found", async () => {
      profile.loadProfiles.mockResolvedValue([null]);

      const rejection = repository.fromDTO({
        _id: "foo",
        profileIds: ["nope"],
      });

      await expect(rejection).rejects.toBeInstanceOf(InternalError);
      await expect(rejection).rejects.toMatchObject({
        id: "security.user.cannot_hydrate",
      });
    });

    it("should reject if the user has no profile associated to it", async () => {
      const rejection = repository.fromDTO({ _id: "foo" });

      await expect(rejection).rejects.toBeInstanceOf(InternalError);
      await expect(rejection).rejects.toMatchObject({
        id: "security.user.no_profile",
      });
    });
  });

  describe("#load", () => {
    it.each(["-1", "anonymous"])(
      "should answer the anonymous user for %s without loading anything",
      async (id) => {
        const parent = vi
          .spyOn(ObjectRepository.prototype, "load")
          .mockResolvedValue(null);

        expectAnonymous(await repository.load(id));
        expect(parent).not.toHaveBeenCalled();
      },
    );

    it("should invoke the parent load method", async () => {
      const user = new User();
      vi.spyOn(ObjectRepository.prototype, "load").mockResolvedValue(user);

      await expect(repository.load("foo")).resolves.toBe(user);
    });

    it("should report a user it could not build as missing", async () => {
      vi.spyOn(ObjectRepository.prototype, "load").mockResolvedValue(null);

      await expect(repository.load("foo")).rejects.toMatchObject({
        id: "security.user.not_found",
      });
    });
  });

  describe("#serializeToCache", () => {
    it("should return a valid plain object", () => {
      const result = repository.serializeToCache(repository.anonymousUser);

      expect(result).not.toBeInstanceOf(User);
      expect(result).toMatchObject({ _id: "-1", profileIds: ["anonymous"] });
    });
  });

  describe("#persist", () => {
    let persistToDatabase: ReturnType<typeof vi.spyOn>;
    let persistToCache: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      persistToDatabase = vi
        .spyOn(repository, "persistToDatabase")
        .mockResolvedValue(undefined);
      persistToCache = vi
        .spyOn(repository, "persistToCache")
        .mockResolvedValue(undefined as never);
    });

    it("should persist in both the db and the cache with default options", async () => {
      const user = invalid<User>({ _id: "foo", profileIds: ["bar"] });

      await repository.persist(user);

      expect(persistToDatabase).toHaveBeenCalledWith(user, {});
      expect(persistToCache).toHaveBeenCalledWith(user, {});
    });

    it("should forward the options it is given", async () => {
      const user = invalid<User>({ _id: "foo", profileIds: ["bar"] });
      const options = { cache: { baz: "qux" }, database: { foo: "bar" } };

      await repository.persist(user, options);

      expect(persistToDatabase).toHaveBeenCalledWith(user, options.database);
      expect(persistToCache).toHaveBeenCalledWith(user, options.cache);
    });

    it("should refuse to remove the anonymous profile from the anonymous user", async () => {
      const rejection = repository.persist(
        invalid<User>({ _id: "-1", profileIds: ["test"] }),
      );

      await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection).rejects.toMatchObject({
        id: "security.user.anonymous_profile_required",
      });
    });
  });

  describe("#adminExists", () => {
    it("should search for a user carrying the admin profile", async () => {
      const search = vi
        .spyOn(repository, "search")
        .mockResolvedValue(invalid({ total: 0 }));

      await repository.adminExists();

      // `{ size: 1 }` too: only the first hit matters, and sinon's
      // `calledWith` let the Mocha spec omit it — extra arguments match.
      expect(search).toHaveBeenCalledWith(
        { query: { term: { profileIds: "admin" } } },
        { size: 1 },
      );
    });

    it.each([
      [0, false],
      [42, true],
    ])("should answer %s hits as %s", async (total, expected) => {
      vi.spyOn(repository, "search").mockResolvedValue(invalid({ total }));

      await expect(repository.adminExists()).resolves.toBe(expected);
    });
  });

  describe("#delete", () => {
    let fakeUser: User;
    let parentDelete: ReturnType<typeof vi.spyOn>;
    let deleteByUser: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      fakeUser = new User();
      fakeUser._id = "foo";

      deleteByUser = vi
        .spyOn(ApiKey, "deleteByUser")
        .mockResolvedValue(undefined as never);
      parentDelete = vi
        .spyOn(ObjectRepository.prototype, "delete")
        .mockResolvedValue(undefined);
      vi.spyOn(repository, "load").mockResolvedValue(fakeUser);
    });

    it("should load and delete the provided user", async () => {
      await ask("core:security:user:delete", "foo");

      expect(repository.load).toHaveBeenCalledWith("foo");
      expect(deleteByUser).toHaveBeenCalledWith(fakeUser, { refresh: "false" });
      expect(token.deleteByKuid).toHaveBeenCalledWith("foo");
      expect(parentDelete).toHaveBeenCalledWith(fakeUser, { refresh: "false" });
    });

    it("should forward the refresh option", async () => {
      await ask("core:security:user:delete", "foo", { refresh: "wait_for" });

      expect(deleteByUser).toHaveBeenCalledWith(fakeUser, {
        refresh: "wait_for",
      });
      expect(parentDelete).toHaveBeenCalledWith(fakeUser, {
        refresh: "wait_for",
      });
    });

    it("should delete the user's credentials on every strategy it exists on", async () => {
      const exists = vi.fn(async () => true);
      const remove = vi.fn(async () => undefined);

      listStrategies.mockReturnValue(["someStrategy"]);
      getStrategyMethod.mockReturnValueOnce(exists).mockReturnValueOnce(remove);

      await ask("core:security:user:delete", "foo");

      for (const method of [exists, remove]) {
        expect(method).toHaveBeenCalledOnce();
        expect(method).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.objectContaining({ args: { _id: "foo" } }),
          }),
          "foo",
          "someStrategy",
        );
      }
    });
  });

  describe("#create / #replace / #update", () => {
    let fakeUser: User;
    let persist: ReturnType<typeof vi.spyOn>;
    let fromDTO: ReturnType<typeof vi.spyOn>;

    const content = {
      _id: "nope",
      _kuzzle_info: "nope",
      foo: "foo",
      profileIds: ["nope"],
    };

    /** The DTO the repository built out of the arguments. */
    const dto = () =>
      fromDTO.mock.calls[0]?.[0] as {
        _id: string;
        foo: string;
        profileIds: string[];
        _kuzzle_info: Record<string, unknown>;
      };

    beforeEach(() => {
      fakeUser = new User();
      fakeUser._id = "foo";
      fakeUser.profileIds = ["foo", "bar"];
      Object.assign(fakeUser, {
        _kuzzle_info: {
          createdAt: "createdAt",
          updatedAt: "foo",
          updater: "bar",
          author: "author",
        },
      });

      persist = vi.spyOn(repository, "persist").mockResolvedValue(fakeUser);
      fromDTO = vi.spyOn(repository, "fromDTO").mockResolvedValue(fakeUser);
      vi.spyOn(repository, "load").mockResolvedValue(fakeUser);
    });

    it.each([
      ["core:security:user:create", "create"],
      ["core:security:user:replace", "replace"],
    ] as const)(
      "%s should build the DTO and persist it",
      async (event, method) => {
        await ask(event, "id", ["foo", "bar"], content, { userId: "userId" });

        expect(dto()).toMatchObject({
          foo: "foo",
          profileIds: ["foo", "bar"],
          _id: "id",
          _kuzzle_info: { author: "userId", updatedAt: null, updater: null },
        });
        expect(dto()._kuzzle_info.createdAt).toBeCloseTo(Date.now(), -3);

        expect(persist).toHaveBeenCalledWith(fakeUser, {
          database: { method, refresh: "false" },
        });
      },
    );

    it.each([
      ["core:security:user:create", "create"],
      ["core:security:user:replace", "replace"],
    ] as const)(
      "%s should handle the refresh option",
      async (event, method) => {
        await ask(
          event,
          "id",
          [],
          {},
          { refresh: "wait_for", userId: "userId" },
        );

        expect(persist).toHaveBeenCalledWith(fakeUser, {
          database: { method, refresh: "wait_for" },
        });
      },
    );

    it.each([
      "core:security:user:create",
      "core:security:user:replace",
      "core:security:user:update",
    ])("%s should answer the persisted user", async (event) => {
      await expect(
        ask(event, "id", [], {}, { userId: "userId" }),
      ).resolves.toBe(fakeUser);
    });

    it("should replace a generic already-exists failure with a security one", async () => {
      const error = new Error("foo");

      persist.mockRejectedValue(error);
      await expect(
        ask("core:security:user:create", "id", [], {}, {}),
      ).rejects.toBe(error);

      Object.assign(error, { id: "services.storage.document_already_exists" });

      const rejection = ask("core:security:user:create", "id", [], {}, {});
      await expect(rejection).rejects.toBeInstanceOf(PreconditionError);
      await expect(rejection).rejects.toMatchObject({
        id: "security.user.already_exists",
      });
    });

    it.each(["core:security:user:replace", "core:security:user:update"])(
      "%s should reject if the user does not exist",
      async (event) => {
        const error = new Error("does not exist");
        vi.spyOn(repository, "load").mockRejectedValue(error);

        await expect(ask(event, "id", [], {}, {})).rejects.toBe(error);
      },
    );

    describe("#update", () => {
      it("should build the update DTO and persist it", async () => {
        await ask("core:security:user:update", "id", ["baz", "qux"], content);

        expect(dto()).toMatchObject({
          foo: "foo",
          profileIds: ["baz", "qux"],
          _id: "id",
          _kuzzle_info: {
            updater: undefined,
            createdAt: "createdAt",
            author: "author",
          },
        });
        expect(dto()._kuzzle_info.updatedAt).toBeCloseTo(Date.now(), -3);

        expect(persist).toHaveBeenCalledWith(fakeUser, {
          database: { method: "update", refresh: "false", retryOnConflict: 10 },
        });
      });

      it("should keep the previous profiles when none are given", async () => {
        await ask("core:security:user:update", "id", null, content, {
          userId: "userId",
        });

        expect(dto()).toMatchObject({
          profileIds: ["foo", "bar"],
          _kuzzle_info: { updater: "userId", createdAt: "createdAt" },
        });
      });

      it("should handle its options", async () => {
        await ask(
          "core:security:user:update",
          "id",
          [],
          {},
          { refresh: "wait_for", retryOnConflict: 123, userId: "userId" },
        );

        expect(persist).toHaveBeenCalledWith(fakeUser, {
          database: {
            method: "update",
            refresh: "wait_for",
            retryOnConflict: 123,
          },
        });
      });
    });
  });

  describe("#loadOneFromDatabase", () => {
    it("should invoke its super function", async () => {
      const parent = vi
        .spyOn(ObjectRepository.prototype, "loadOneFromDatabase")
        .mockResolvedValue(invalid<User>("foo"));

      await expect(repository.loadOneFromDatabase("bar")).resolves.toBe("foo");
      expect(parent).toHaveBeenCalledWith("bar");
    });

    it("should wrap generic 404s into user-dedicated errors", async () => {
      vi.spyOn(
        ObjectRepository.prototype,
        "loadOneFromDatabase",
      ).mockRejectedValue(Object.assign(new Error("foo"), { status: 404 }));

      const rejection = repository.loadOneFromDatabase("foo");

      await expect(rejection).rejects.toBeInstanceOf(NotFoundError);
      await expect(rejection).rejects.toMatchObject({
        id: "security.user.not_found",
      });
    });

    it("should re-throw non-404 errors as is", async () => {
      const error = new Error("foo");

      vi.spyOn(
        ObjectRepository.prototype,
        "loadOneFromDatabase",
      ).mockRejectedValue(error);

      await expect(repository.loadOneFromDatabase("foo")).rejects.toBe(error);
    });
  });
});
