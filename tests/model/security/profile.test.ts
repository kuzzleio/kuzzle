import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Request } from "../../../lib/api/request/kuzzleRequest";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { PreconditionError } from "../../../lib/kerror/errors/preconditionError";
import { Profile } from "../../../lib/model/security/profile";
import { Role } from "../../../lib/model/security/role";
import type { Policy } from "../../../lib/types/Policy";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/** A deterministic stand-in for the `murmur.v3` hash `profileRepository` patches in. */
const hash = (item: unknown) => {
  const json = JSON.stringify(item);
  let value = 0;

  for (const char of json) {
    value = (value * 31 + char.charCodeAt(0)) | 0;
  }

  return value;
};

/** One entry of what `getRights()` answers. */
type RightsItem = {
  controller: string;
  action: string;
  index: string;
  collection: string;
  value: string;
};

describe("#model/security/Profile", () => {
  const context = { connectionId: null, userId: null };
  const request = new Request(
    {
      index: "index",
      collection: "collection",
      controller: "controller",
      action: "action",
    },
    context,
  );

  let roles: Record<string, Role>;
  let indexExists: boolean;
  let collectionExists: boolean;
  let profile: Profile;

  beforeEach(() => {
    roles = {};
    indexExists = true;
    collectionExists = true;
    profile = new Profile();

    /*
     * Three events, and they are the whole of what a Profile asks the
     * application for: its roles, and — in strict mode only — whether the
     * index and collection a policy restricts to exist.
     */
    stubKuzzle({
      ask: vi.fn(async (event: string, ...args: string[]) => {
        switch (event) {
          case "core:security:role:get":
            return roles[args[0] as string];
          case "core:storage:public:index:exist":
            return indexExists;
          case "core:storage:public:collection:exist":
            return collectionExists;
          default:
            throw new Error(`unexpected ask("${event}")`);
        }
      }),
    });
  });

  afterEach(() => {
    restoreKuzzle();
  });

  const role = (id: string, controllers: Role["controllers"]) => {
    const created = new Role();

    created._id = id;
    created.controllers = controllers;
    roles[id] = created;

    return created;
  };

  it("should disallow any action when no role can be found", async () => {
    await expect(profile.isActionAllowed(request)).resolves.toBe(false);
  });

  it("should allow the action if one of the roles allows it", async () => {
    role("denyRole", { "*": { actions: { "*": false } } });
    role("allowRole", { controller: { actions: { action: true } } });

    profile.optimizedPolicies = [{ roleId: "denyRole" }];
    await expect(profile.isActionAllowed(request)).resolves.toBe(false);

    profile.optimizedPolicies.push({ roleId: "allowRole" });
    await expect(profile.isActionAllowed(request)).resolves.toBe(true);

    // …unless the allowing role is restricted to indexes the request is not on.
    profile.optimizedPolicies = [
      { roleId: "denyRole" },
      {
        roleId: "allowRole",
        restrictedTo: new Map(
          Object.entries({
            index2: ["collection1"],
            index3: ["collection1", "collection2"],
          }),
        ),
      },
    ];
    await expect(profile.isActionAllowed(request)).resolves.toBe(false);
  });

  describe("#getRights", () => {
    beforeEach(() => {
      /*
       * `_hash` is a static placeholder that `profileRepository` replaces with
       * `global.kuzzle.hash` at startup — un-patched it returns `false`, so
       * every right would collapse onto one key. The Mocha spec patched it and
       * never put it back, which leaks into whatever runs next in the same
       * process.
       */
      Profile._hash = hash;
    });

    afterEach(() => {
      Profile._hash = () => false;
    });

    it("should retrieve the correct rights list", async () => {
      role("role1", { document: { actions: { "*": true } } });
      role("role2", {
        document: { actions: { delete: true, create: true, update: true } },
      });
      role("role3", {
        document: {
          actions: { get: true, count: true, search: true, create: true },
        },
      });

      profile.optimizedPolicies = [
        {
          roleId: "role1",
          restrictedTo: new Map(
            Object.entries({ index1: ["collection1", "collection2"] }),
          ),
        },
        {
          roleId: "role2",
          restrictedTo: new Map(Object.entries({ index2: [] })),
        },
        { roleId: "role3" },
      ];

      const rights = Object.values(await profile.getRights()) as RightsItem[];

      const forAction = (action: string) =>
        rights.filter(
          (item) => item.controller === "document" && item.action === action,
        );

      // role3 is unrestricted, so its rights apply everywhere.
      expect(forAction("get")).toHaveLength(1);
      expect(forAction("get")[0]).toMatchObject({
        index: "*",
        collection: "*",
        value: "allowed",
      });

      // role1's wildcard action, once per restricted collection.
      expect(forAction("*")).toHaveLength(2);
      expect(
        forAction("*")
          .map((item) => item.collection)
          .sort(),
      ).toEqual(["collection1", "collection2"]);
      expect(
        forAction("*").every(
          (item) => item.index === "index1" && item.value === "allowed",
        ),
      ).toBe(true);

      // role2 restricts to an index and no collection, which means all of them.
      expect(forAction("delete")).toHaveLength(1);
      expect(forAction("delete")[0]).toMatchObject({
        index: "index2",
        collection: "*",
        value: "allowed",
      });

      expect(
        forAction("update").every(
          (item) =>
            item.index === "index2" &&
            item.collection === "*" &&
            item.value === "allowed",
        ),
      ).toBe(true);
    });
  });

  describe("#validateDefinition", () => {
    beforeEach(() => {
      profile._id = "test";
    });

    /** The rejection `validateDefinition` answers, twice — one per assertion. */
    const rejects = async (
      id: string,
      error:
        typeof BadRequestError | typeof PreconditionError = BadRequestError,
      options?: { strict: boolean },
    ) => {
      await expect(profile.validateDefinition(options)).rejects.toBeInstanceOf(
        error,
      );
      await expect(profile.validateDefinition(options)).rejects.toMatchObject({
        id,
      });
    };

    it("should reject if no policies are provided", async () => {
      profile.policies = invalid<Policy[]>(null);

      await rejects("api.assert.missing_argument");
    });

    it("should reject if invalid policies are provided", async () => {
      profile.policies = invalid<Policy[]>("foo");

      await rejects("api.assert.invalid_type");
    });

    it("should reject if an empty policies array is provided", async () => {
      await rejects("api.assert.empty_argument");
    });

    it("should reject if no roleId is given", async () => {
      profile.policies = [invalid<Policy>({})];

      await rejects("api.assert.missing_argument");
      await expect(profile.validateDefinition()).rejects.toMatchObject({
        message: 'Missing argument "test.policies[0].roleId".',
      });
    });

    it("should reject if an invalid attribute is given", async () => {
      profile.policies = [invalid<Policy>({ roleId: "admin", foo: "bar" })];

      await rejects("api.assert.unexpected_argument");
    });

    it("should reject if restrictedTo is not an array", async () => {
      profile.policies = [
        invalid<Policy>({ roleId: "admin", restrictedTo: "bar" }),
      ];

      await rejects("api.assert.invalid_type");
    });

    it("should reject if restrictedTo contains a non-object value", async () => {
      profile.policies = [
        invalid<Policy>({ roleId: "admin", restrictedTo: [null] }),
      ];

      await rejects("api.assert.invalid_type");
    });

    it("should reject if restrictedTo does not contain an index", async () => {
      profile.policies = [
        invalid<Policy>({ roleId: "admin", restrictedTo: [{ foo: "bar" }] }),
      ];

      await rejects("api.assert.missing_argument");
    });

    it("should reject if restrictedTo is given an invalid attribute", async () => {
      profile.policies = [
        invalid<Policy>({
          roleId: "admin",
          restrictedTo: [{ index: "index", foo: "bar" }],
        }),
      ];

      await rejects("api.assert.unexpected_argument");
    });

    it("should reject if restrictedTo points to an unknown index (strict mode)", async () => {
      profile.policies = [
        invalid<Profile["policies"][number]>({
          roleId: "admin",
          restrictedTo: [{ index: "index" }],
        }),
      ];
      indexExists = false;

      // Non-strict does not look: the same definition validates.
      await expect(profile.validateDefinition()).resolves.toBe(true);

      await rejects("services.storage.unknown_index", PreconditionError, {
        strict: true,
      });

      expect(global.kuzzle.ask).toHaveBeenCalledWith(
        "core:storage:public:index:exist",
        "index",
      );
    });

    it("should reject if restrictedTo.collections is not an array", async () => {
      profile.policies = [
        invalid<Policy>({
          roleId: "admin",
          restrictedTo: [{ index: "index", collections: "bar" }],
        }),
      ];

      await rejects("api.assert.invalid_type");
    });

    it("should reject if restrictedTo points to an unknown collection (strict mode)", async () => {
      profile.policies = [
        {
          roleId: "admin",
          restrictedTo: [{ index: "index", collections: ["foo"] }],
        },
      ];
      collectionExists = false;

      await expect(profile.validateDefinition()).resolves.toBe(true);

      await rejects("services.storage.unknown_collection", PreconditionError, {
        strict: true,
      });

      expect(global.kuzzle.ask).toHaveBeenCalledWith(
        "core:storage:public:collection:exist",
        "index",
        "foo",
      );
    });

    it("should force the rateLimit to 0 if none is provided", async () => {
      profile.policies = [{ roleId: "admin" }];

      profile.rateLimit = invalid<number>(null);
      await profile.validateDefinition();
      expect(profile.rateLimit).toBe(0);

      profile.rateLimit = invalid<number>(undefined);
      await profile.validateDefinition();
      expect(profile.rateLimit).toBe(0);
    });

    it("should throw if the rate limit is not a valid integer", async () => {
      profile.policies = [{ roleId: "admin" }];

      /*
       * The Mocha spec asserted inside a `catch` and had no `else`: had
       * `validateDefinition` accepted any of these six, the test would have
       * passed by not entering the block.
       */
      for (const rateLimit of ["foo", {}, [], 123.45, true, false]) {
        profile.rateLimit = invalid<number>(rateLimit);

        await rejects("api.assert.invalid_type");
      }
    });

    it("should throw if the rate limit is a negative integer", async () => {
      profile.policies = [{ roleId: "admin" }];
      profile.rateLimit = -2;

      await rejects("api.assert.invalid_argument");
    });
  });
});
