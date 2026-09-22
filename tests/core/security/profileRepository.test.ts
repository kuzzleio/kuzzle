import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileRepository } from "../../../lib/core/security/profileRepository";
import { ObjectRepository } from "../../../lib/core/shared/ObjectRepository";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { InternalError } from "../../../lib/kerror/errors/internalError";
import { NotFoundError } from "../../../lib/kerror/errors/notFoundError";
import { PreconditionError } from "../../../lib/kerror/errors/preconditionError";
import { Profile } from "../../../lib/model/security/profile";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubAsk, stubKuzzle } from "../../mocks/kuzzle";

describe("#core/security/ProfileRepository", () => {
  let repository: ProfileRepository;
  let testProfile: Profile;
  let role: { loadRoles: ReturnType<typeof vi.fn> };
  let user: {
    search: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let bus: ReturnType<typeof stubAsk>;
  let cache: Map<string, string>;

  beforeEach(async () => {
    role = { loadRoles: vi.fn(async () => []) };
    user = { search: vi.fn(async () => ({})), update: vi.fn() };
    cache = new Map();

    /*
     * The storage and cache events a repository *asks*, as opposed to the ones
     * it answers. An in-memory cache rather than a stub per test: `load` reads
     * it, `validateAndSaveProfile` writes it, and a spec about either should
     * not have to restate the other.
     */
    bus = stubAsk((event: string, ...args: unknown[]) => {
      switch (event) {
        case "core:cache:internal:get":
          return cache.get(args[0] as string) ?? null;
        case "core:cache:internal:store":
          cache.set(args[0] as string, args[1] as string);
          return undefined;
        case "core:cache:internal:del":
          cache.delete(args[0] as string);
          return undefined;
        case "core:cache:internal:expire":
        case "core:cache:internal:persist":
          return undefined;
        case "core:storage:public:index:exist":
        case "core:storage:public:collection:exist":
          return true;
        default:
          throw new Error(`unexpected ask("${event}")`);
      }
    });

    stubKuzzle({
      ask: bus.ask,
      onAsk: bus.onAsk,
      config: { repositories: { common: { cacheTTL: 1440000 } } },
      hash: (object: unknown) => JSON.stringify(object),
      internalIndex: { index: "%kuzzle" },
    });

    /* The module interface is declared inside the subject's own file and not
     * exported; its constructor is what names it. */
    repository = new ProfileRepository(
      invalid<ConstructorParameters<typeof ProfileRepository>[0]>({
        role,
        user,
      }),
    );

    testProfile = new Profile();
    testProfile._id = "foo";
    testProfile.policies = [
      // `PolicyRestrictions.collections` is declared required while
      // `optimizePolicy` skips a restriction that has none — a restriction on
      // a whole index is what this is, and the type cannot say it yet.
      invalid<Profile["policies"][number]>({
        roleId: "test",
        restrictedTo: [{ index: "index" }],
      }),
      { roleId: "test2" },
    ];

    await repository.init();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreKuzzle();
  });

  /** Answers the event the way the application would. */
  const ask = (event: string, ...args: unknown[]) =>
    global.kuzzle.ask(event, ...args);

  describe("#init", () => {
    /*
     * One test per registration rather than nine near-identical ones: what
     * `init` promises is that each event reaches a method, and the pairs are
     * the test. The Mocha spec asserted the same thing by calling
     * `kuzzle.ask.restore()` in nine places.
     */
    it.each([
      ["core:security:profile:create", "create", ["foo", "bar", "baz"]],
      [
        "core:security:profile:createOrReplace",
        "createOrReplace",
        ["foo", "bar", "baz"],
      ],
      ["core:security:profile:delete", "deleteById", ["foo", "bar"]],
      ["core:security:profile:get", "load", ["foo"]],
      ["core:security:profile:invalidate", "deleteFromCache", ["foo"]],
      ["core:security:profile:mGet", "loadProfiles", ["foo"]],
      ["core:security:profile:scroll", "scroll", ["foo", "bar"]],
      ["core:security:profile:search", "search", ["foo", "bar"]],
      ["core:security:profile:truncate", "truncate", ["foo"]],
      ["core:security:profile:update", "update", ["foo", "bar", "baz"]],
    ])("should answer %s with %s()", async (event, method, args) => {
      const spy = invalid<ReturnType<typeof vi.fn>>(
        vi.spyOn(repository, method as never),
      );
      spy.mockResolvedValue(undefined);

      await ask(event, ...args);

      expect(spy).toHaveBeenCalledWith(...args);
    });
  });

  describe("#load", () => {
    it("should reject if the profile does not exist", async () => {
      vi.spyOn(
        ObjectRepository.prototype,
        "loadOneFromDatabase",
      ).mockRejectedValue(new NotFoundError("Not found"));

      const rejection = repository.load("idontexist");

      await expect(rejection).rejects.toBeInstanceOf(NotFoundError);
      await expect(rejection).rejects.toMatchObject({
        id: "security.profile.not_found",
      });
    });

    it("should load a profile from the db", async () => {
      role.loadRoles.mockResolvedValue([{ _id: "default" }]);
      vi.spyOn(
        ObjectRepository.prototype,
        "loadOneFromDatabase",
      ).mockResolvedValue(testProfile);

      await expect(repository.load("foo")).resolves.toBe(testProfile);
    });

    it("should compute the optimized policies", async () => {
      vi.spyOn(
        ObjectRepository.prototype,
        "loadOneFromDatabase",
      ).mockResolvedValue(testProfile);

      const profile = await repository.load("foobar");

      /*
       * `optimizePolicies` is private, and the Mocha spec stubbed it to assert
       * it had been called. What it is for is visible on the way out: the
       * `restrictedTo` array becomes a Map, per policy.
       */
      expect(profile.optimizedPolicies).toEqual([
        { roleId: "test", restrictedTo: new Map([["index", []]]) },
        { roleId: "test2" },
      ]);
    });
  });

  describe("#loadProfiles", () => {
    it("should reject if profileIds is not an array of strings", async () => {
      const rejection = repository.loadProfiles(
        invalid<string[]>(["a string", { foo: "bar" }]),
      );

      await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection).rejects.toMatchObject({
        id: "api.assert.invalid_type",
        message: 'Wrong type for argument "profileIds" (expected: string[])',
      });
    });

    it("should resolve to an empty array if the input is empty", async () => {
      const loadOneFromDatabase = vi.spyOn(repository, "loadOneFromDatabase");

      await expect(repository.loadProfiles([])).resolves.toEqual([]);
      expect(loadOneFromDatabase).not.toHaveBeenCalled();
    });

    it("should load every profile it is given", async () => {
      const profiles = ["p1", "p2", "p3"].map((id) => {
        const profile = new Profile();
        profile._id = id;
        return profile;
      });

      const loadOneFromDatabase = vi
        .spyOn(repository, "loadOneFromDatabase")
        .mockImplementation(
          async (id: string) =>
            profiles.find((profile) => profile._id === id) as Profile,
        );

      await expect(
        repository.loadProfiles(["p1", "p2", "p3"]),
      ).resolves.toEqual(profiles);

      for (const id of ["p1", "p2", "p3"]) {
        expect(loadOneFromDatabase).toHaveBeenCalledWith(id);
      }
    });
  });

  describe("#fromDTO", () => {
    it("should throw if the profile contains non-existing roles", async () => {
      role.loadRoles.mockResolvedValue([null]);

      const rejection = repository.fromDTO({
        policies: [{ roleId: "notExistingRole" }],
      });

      await expect(rejection).rejects.toBeInstanceOf(InternalError);
      await expect(rejection).rejects.toMatchObject({
        id: "security.profile.cannot_hydrate",
      });
    });

    it("should set the default role when none is given", async () => {
      role.loadRoles.mockResolvedValue([{ _id: "default" }]);

      const profile = await repository.fromDTO({});

      expect(profile.policies).toMatchObject([{ roleId: "default" }]);
    });
  });

  describe("#deleteById", () => {
    let deleteFromCache: ReturnType<typeof vi.spyOn>;
    let deleteFromDatabase: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      vi.spyOn(repository, "load").mockResolvedValue(testProfile);
      deleteFromCache = vi
        .spyOn(repository, "deleteFromCache")
        .mockResolvedValue(undefined);
      deleteFromDatabase = vi
        .spyOn(repository, "deleteFromDatabase")
        .mockResolvedValue({ acknowledge: true });
    });

    it("should reject, and delete nothing, if a user still uses the profile", async () => {
      user.search.mockResolvedValue({ total: 1 });

      const rejection = repository.deleteById(testProfile._id as string);

      await expect(rejection).rejects.toBeInstanceOf(PreconditionError);
      await expect(rejection).rejects.toMatchObject({
        id: "security.profile.in_use",
      });

      expect(user.search).toHaveBeenCalledWith(
        { query: { terms: { profileIds: ["foo"] } } },
        { from: 0, size: 1 },
      );
      expect(deleteFromDatabase).not.toHaveBeenCalled();
      expect(deleteFromCache).not.toHaveBeenCalled();
    });

    it.each(["anonymous", "default", "admin"])(
      "should refuse to delete the reserved profile %s",
      async (id) => {
        testProfile._id = id;

        const rejection = repository.deleteById(id);

        await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
        await expect(rejection).rejects.toMatchObject({
          id: "security.profile.cannot_delete",
        });

        expect(user.search).not.toHaveBeenCalled();
        expect(deleteFromDatabase).not.toHaveBeenCalled();
        expect(deleteFromCache).not.toHaveBeenCalled();
      },
    );

    it("should delete from both the database and the cache", async () => {
      await repository.deleteById("foo");

      expect(deleteFromDatabase).toHaveBeenCalledOnce();
      expect(deleteFromDatabase).toHaveBeenCalledWith("foo", {
        refresh: "false",
      });
      expect(deleteFromCache).toHaveBeenCalledOnce();
      // The cache deletion is given the id alone: `deleteFromCache` reads only
      // `options.key`, and `delete` does not forward the write options to it.
      expect(deleteFromCache).toHaveBeenCalledWith("foo");
    });

    it("should be able to handle the refresh option", async () => {
      await repository.deleteById("foo", { refresh: "wait_for" });

      expect(deleteFromDatabase).toHaveBeenCalledWith("foo", {
        refresh: "wait_for",
      });
    });

    it("should be able to remove the profile from its users when required", async () => {
      const assigned = { _id: "baz", foo: "bar", profileIds: ["foo"] };

      user.search.mockResolvedValue({ hits: [assigned], total: 1 });

      await repository.deleteById("foo", { onAssignedUsers: "remove" });

      expect(user.update).toHaveBeenCalledOnce();
      expect(user.update).toHaveBeenCalledWith(
        "baz",
        ["anonymous"],
        assigned,
        expect.anything(),
      );
      expect(deleteFromDatabase).toHaveBeenCalledWith("foo", {
        refresh: "false",
      });
    });
  });

  describe("#serializeToDatabase", () => {
    it("should return a plain flat object", () => {
      const result = repository.serializeToDatabase(testProfile);

      expect(result).not.toBeInstanceOf(Profile);
      expect(result).not.toHaveProperty("_id");
      expect(result.policies).toHaveLength(2);
      expect(result.policies[0]).toMatchObject({
        roleId: "test",
        restrictedTo: [{ index: "index" }],
      });
      expect(result.policies[1]).toEqual({ roleId: "test2" });
      expect(result.policies[1]).not.toHaveProperty("restrictedTo");
    });
  });

  describe("#validateAndSaveProfile", () => {
    it("should throw if roles cannot be loaded", async () => {
      const error = new Error("foo");
      const profile = new Profile();
      profile._id = "awesomeProfile";
      profile.policies = [{ roleId: "notSoAwesomeRole" }];

      role.loadRoles.mockRejectedValue(error);

      await expect(repository.validateAndSaveProfile(profile)).rejects.toBe(
        error,
      );
    });

    it("should persist the profile and answer the stored one", async () => {
      const persistToDatabase = vi
        .spyOn(ObjectRepository.prototype, "persistToDatabase")
        .mockResolvedValue(null);
      vi.spyOn(repository, "loadOneFromDatabase").mockResolvedValue(
        testProfile,
      );

      await expect(
        repository.validateAndSaveProfile(testProfile),
      ).resolves.toBe(testProfile);

      expect(persistToDatabase).toHaveBeenCalledOnce();
      // Recomputed on the way out, from what the database answered.
      expect(testProfile.optimizedPolicies).toEqual([
        { roleId: "test", restrictedTo: new Map([["index", []]]) },
        { roleId: "test2" },
      ]);
    });

    it("should reject an anonymous profile that drops the anonymous role", async () => {
      const profile = new Profile();
      profile._id = "anonymous";
      profile.policies = [{ roleId: "test" }, { roleId: "another" }];

      const rejection = repository.validateAndSaveProfile(profile);

      await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection).rejects.toMatchObject({
        id: "security.profile.missing_anonymous_role",
      });
    });

    it("should accept the anonymous profile while the anonymous role is still in", async () => {
      const profile = new Profile();
      profile._id = "anonymous";
      profile.policies = [{ roleId: "test" }, { roleId: "anonymous" }];

      vi.spyOn(
        ObjectRepository.prototype,
        "persistToDatabase",
      ).mockResolvedValue(null);
      vi.spyOn(repository, "loadOneFromDatabase").mockResolvedValue(profile);

      const response = await repository.validateAndSaveProfile(profile);

      expect(response._id).toBe("anonymous");
    });
  });

  describe("#loadOneFromDatabase", () => {
    it("should invoke its super function", async () => {
      const parent = vi
        .spyOn(ObjectRepository.prototype, "loadOneFromDatabase")
        .mockResolvedValue(invalid<Profile>("foo"));

      await expect(repository.loadOneFromDatabase("bar")).resolves.toBe("foo");
      expect(parent).toHaveBeenCalledWith("bar");
    });

    it("should wrap generic 404s into profile-dedicated errors", async () => {
      const error = Object.assign(new Error("foo"), { status: 404 });

      vi.spyOn(
        ObjectRepository.prototype,
        "loadOneFromDatabase",
      ).mockRejectedValue(error);

      const rejection = repository.loadOneFromDatabase("foo");

      await expect(rejection).rejects.toBeInstanceOf(NotFoundError);
      await expect(rejection).rejects.toMatchObject({
        id: "security.profile.not_found",
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

    it("should report a document with no id as a missing profile", async () => {
      vi.spyOn(
        ObjectRepository.prototype,
        "loadOneFromDatabase",
      ).mockResolvedValue(null);

      await expect(repository.loadOneFromDatabase("foo")).rejects.toMatchObject(
        { id: "security.profile.not_found" },
      );
    });
  });

  describe("#create / #createOrReplace / #update", () => {
    let validateAndSaveProfile: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      validateAndSaveProfile = vi
        .spyOn(repository, "validateAndSaveProfile")
        .mockResolvedValue(invalid<Profile>("foobar"));
      role.loadRoles.mockResolvedValue([]);
    });

    const content = {
      _id: "ohnoes",
      _kuzzle_info: "nope",
      bar: "bar",
      foo: "foo",
    };

    /** The profile `validateAndSaveProfile` was handed. */
    const saved = () =>
      validateAndSaveProfile.mock.calls[0]?.[0] as unknown as Profile &
        Record<string, unknown>;

    it.each(["create", "createOrReplace"] as const)(
      "%s should pass the right configuration to validateAndSaveProfile",
      async (method) => {
        await repository[method]("foobar", content, {
          refresh: "refresh",
          userId: "userId",
        });

        expect(validateAndSaveProfile).toHaveBeenCalledWith(
          expect.any(Profile),
          expect.objectContaining({ method, refresh: "refresh" }),
        );

        // The `_id` and `_kuzzle_info` in the content are ignored: the id is
        // the argument, and the metadata is built here.
        expect(saved()._id).toBe("foobar");
        expect(saved().bar).toBe("bar");
        expect(saved().foo).toBe("foo");
        expect(saved()._kuzzle_info).toMatchObject({
          author: "userId",
          updatedAt: null,
          updater: null,
        });
        expect(
          (saved()._kuzzle_info as { createdAt: number }).createdAt,
        ).toBeCloseTo(Date.now(), -3);
      },
    );

    it.each(["create", "createOrReplace"] as const)(
      "%s should resolve to the validateAndSaveProfile result",
      async (method) => {
        await expect(repository[method]("foo", {}, {})).resolves.toBe("foobar");
      },
    );

    describe("#update", () => {
      beforeEach(() => {
        vi.spyOn(repository, "load").mockResolvedValue(new Profile());
      });

      it("should reject if the profile does not exist", async () => {
        const error = new Error("foo");
        vi.spyOn(repository, "load").mockRejectedValue(error);

        await expect(repository.update("foo", {}, {})).rejects.toBe(error);
      });

      it("should pass the right configuration to validateAndSaveProfile", async () => {
        await repository.update("foobar", content, {
          refresh: "refresh",
          userId: "userId",
        });

        expect(validateAndSaveProfile).toHaveBeenCalledWith(
          expect.any(Profile),
          expect.objectContaining({ method: "update", refresh: "refresh" }),
        );

        expect(saved()._id).toBe("foobar");
        expect(saved().bar).toBe("bar");
        expect(saved().foo).toBe("foo");
        expect(saved()._kuzzle_info).toMatchObject({ updater: "userId" });
        expect(
          (saved()._kuzzle_info as { updatedAt: number }).updatedAt,
        ).toBeCloseTo(Date.now(), -3);
      });

      it("should resolve to the validateAndSaveProfile result", async () => {
        await expect(repository.update("foo", {}, {})).resolves.toBe("foobar");
      });
    });
  });

  describe("optimized policies", () => {
    /*
     * `optimizePolicy` is private; `load` is where its result becomes visible,
     * which is also the only way the application reaches it.
     */
    const optimizedOf = async (restrictedTo: unknown[]) => {
      const profile = new Profile();
      profile._id = "foo";
      profile.policies = invalid<Profile["policies"]>([
        { roleId: "foo", restrictedTo },
      ]);

      vi.spyOn(
        ObjectRepository.prototype,
        "loadOneFromDatabase",
      ).mockResolvedValue(profile);

      return (await repository.load("foo")).optimizedPolicies;
    };

    it("should merge restrictions with the same index", async () => {
      await expect(
        optimizedOf([
          { index: "foo", collections: ["bar"] },
          { index: "foo", collections: ["baz"] },
        ]),
      ).resolves.toEqual([
        { roleId: "foo", restrictedTo: new Map([["foo", ["bar", "baz"]]]) },
      ]);
    });

    it("should remove duplicated collections and sort them", async () => {
      await expect(
        optimizedOf([
          { index: "foo", collections: ["qux", "bar"] },
          { index: "foo", collections: ["baz", "bar"] },
        ]),
      ).resolves.toEqual([
        {
          roleId: "foo",
          restrictedTo: new Map([["foo", ["bar", "baz", "qux"]]]),
        },
      ]);
    });
  });
});
