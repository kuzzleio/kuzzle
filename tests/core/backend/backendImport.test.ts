import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JSONObject } from "kuzzle-sdk";

import type { Backend } from "../../../lib/core/backend/backend";
import type { DefaultMappings } from "../../../lib/core/backend/backendImport";
import { createBackend, internals } from "./backendFixture";

vi.mock("../../../lib/kuzzle", async () => {
  const { FakeKuzzle } = await import("./fakeKuzzle");

  return { Kuzzle: FakeKuzzle, default: FakeKuzzle };
});

describe("BackendImport", () => {
  let application: Backend;

  beforeEach(async () => {
    application = await createBackend();
  });

  const imported = () => internals(application)._import;

  describe("#mappings", () => {
    let mappings: DefaultMappings;

    beforeEach(() => {
      mappings = {
        index1: {
          collection1: {
            mappings: {
              dynamic: "strict",
              _meta: { field: "value" },
              properties: {
                fieldA: { type: "keyword" },
                fieldB: { type: "integer" },
              },
            },
            settings: {
              analysis: {
                analyzer: {
                  content: { type: "custom", tokenizer: "whitespace" },
                },
              },
            },
          },
          collection2: {
            mappings: { properties: { fieldC: { type: "keyword" } } },
          },
        },
        index2: {
          collection1: {
            mappings: { properties: { fieldD: { type: "integer" } } },
          },
        },
      };
    });

    it("imports new mappings", () => {
      application.import.mappings(mappings);

      expect(imported().mappings).toEqual(mappings);
    });

    it("is idempotent", () => {
      application.import.mappings(mappings);
      application.import.mappings(mappings);

      expect(imported().mappings).toEqual(mappings);
    });

    it("merges collection mappings from different calls", () => {
      application.import.mappings(mappings);
      mappings.index1.collection3 = {
        mappings: { properties: { fieldE: { type: "keyword" } } },
      };
      delete mappings.index1.collection2;

      application.import.mappings(mappings);

      expect(imported().mappings).toEqual({
        index1: {
          collection2: {
            mappings: { properties: { fieldC: { type: "keyword" } } },
          },
          ...mappings.index1,
        },
        index2: mappings.index2,
      });
    });

    it("throws if mappings is not an object", () => {
      expect(() =>
        application.import.mappings("not an object" as never),
      ).toThrow(
        expect.objectContaining({ id: "validation.assert.invalid_type" }),
      );
    });

    it("throws if the application is already started", () => {
      internals(application).started = true;

      expect(() => application.import.mappings(mappings)).toThrow(
        expect.objectContaining({ id: "plugin.runtime.already_started" }),
      );
    });
  });

  describe("#profiles", () => {
    let profiles: JSONObject;

    beforeEach(() => {
      profiles = {
        profileA: {
          rateLimit: 50,
          policies: [
            { roleId: "roleA" },
            {
              roleId: "roleB",
              restrictedTo: [
                { index: "index1" },
                {
                  index: "index2",
                  collections: ["collectionA", "collectionB"],
                },
              ],
            },
          ],
        },
        profileB: { policies: [{ roleId: "roleA" }] },
      };
    });

    it("imports a new profile", () => {
      application.import.profiles(profiles);

      expect(imported().profiles).toEqual(profiles);
    });

    it("is idempotent", () => {
      application.import.profiles(profiles);
      application.import.profiles(profiles);

      expect(imported().profiles).toEqual(profiles);
    });

    it("merges profiles from different calls", () => {
      application.import.profiles(profiles);
      profiles.profileC = { policies: [{ roleId: "roleC" }] };
      delete profiles.profileB;

      application.import.profiles(profiles);

      expect(imported().profiles).toEqual({
        profileB: { policies: [{ roleId: "roleA" }] },
        ...profiles,
      });
    });

    it("throws if a profile is not an object", () => {
      expect(() =>
        application.import.profiles("not an object" as never),
      ).toThrow(
        expect.objectContaining({ id: "validation.assert.invalid_type" }),
      );
    });

    it("throws if the application is already started", () => {
      internals(application).started = true;

      expect(() => application.import.profiles(profiles)).toThrow(
        expect.objectContaining({ id: "plugin.runtime.already_started" }),
      );
    });
  });

  describe("#roles", () => {
    let roles: JSONObject;

    beforeEach(() => {
      roles = {
        roleA: {
          controllers: {
            controllerA: { actions: { actionA: true, actionB: false } },
            controllerB: { actions: { "*": true } },
          },
        },
        roleB: { controllers: { "*": { actions: { "*": true } } } },
      };
    });

    it("imports a new role", () => {
      application.import.roles(roles);

      expect(imported().roles).toEqual(roles);
    });

    it("is idempotent", () => {
      application.import.roles(roles);
      application.import.roles(roles);

      expect(imported().roles).toEqual(roles);
    });

    it("merges roles from different calls", () => {
      application.import.roles(roles);
      roles.roleC = {
        controllers: { controllerC: { actions: { "*": true } } },
      };
      delete roles.roleB;

      application.import.roles(roles);

      expect(imported().roles).toEqual({
        roleB: { controllers: { "*": { actions: { "*": true } } } },
        ...roles,
      });
    });

    it("throws if a role is not an object", () => {
      expect(() => application.import.roles("not an object" as never)).toThrow(
        expect.objectContaining({ id: "validation.assert.invalid_type" }),
      );
    });

    it("throws if the application is already started", () => {
      internals(application).started = true;

      expect(() => application.import.roles(roles)).toThrow(
        expect.objectContaining({ id: "plugin.runtime.already_started" }),
      );
    });
  });

  describe("#userMappings", () => {
    let userMappings: JSONObject;

    beforeEach(() => {
      userMappings = {
        properties: { fieldA: { type: "text" }, fieldB: { type: "double" } },
      };
    });

    it("imports new mappings", () => {
      application.import.userMappings(userMappings);

      expect(imported().userMappings).toEqual(userMappings);
    });

    it("is idempotent", () => {
      application.import.userMappings(userMappings);
      application.import.userMappings(userMappings);

      expect(imported().userMappings).toEqual(userMappings);
    });

    it("replaces rather than merges userMappings from different calls", () => {
      application.import.userMappings(userMappings);

      application.import.userMappings({
        properties: { fieldC: { type: "keyword" } },
      });

      expect(imported().userMappings).toEqual({
        properties: { fieldC: { type: "keyword" } },
      });
    });

    it("throws if mappings is not an object", () => {
      expect(() =>
        application.import.userMappings("not an object" as never),
      ).toThrow(
        expect.objectContaining({ id: "validation.assert.invalid_type" }),
      );
    });

    it("throws if the application is already started", () => {
      internals(application).started = true;

      expect(() => application.import.userMappings(userMappings)).toThrow(
        expect.objectContaining({ id: "plugin.runtime.already_started" }),
      );
    });
  });

  describe("#users", () => {
    let users: JSONObject;

    beforeEach(() => {
      users = {
        userA: {
          content: { profileIds: ["profileA", "profileB"], name: "foo" },
          credentials: { local: { username: "bar", password: "foobar" } },
        },
        userB: { content: { profileIds: ["profileA"], name: "bar" } },
      };
    });

    it("imports a new user, defaulting onExistingUsers to skip", () => {
      application.import.users(users);

      expect(imported().users).toEqual(users);
      expect(imported().onExistingUsers).toBe("skip");
    });

    it("handles the onExistingUsers option", () => {
      application.import.users(users, { onExistingUsers: "overwrite" });

      expect(imported().onExistingUsers).toBe("overwrite");
    });

    it("is idempotent", () => {
      application.import.users(users);
      application.import.users(users);

      expect(imported().users).toEqual(users);
    });

    it("merges users from different calls", () => {
      application.import.users(users);
      users.userC = { content: { profileIds: ["profileC"], name: "usr" } };
      delete users.userB;

      application.import.users(users);

      expect(imported().users).toEqual({
        userB: { content: { profileIds: ["profileA"], name: "bar" } },
        ...users,
      });
    });

    it("throws if a user is not an object", () => {
      expect(() => application.import.users("not an object" as never)).toThrow(
        expect.objectContaining({ id: "validation.assert.invalid_type" }),
      );
    });

    it("throws if the application is already started", () => {
      internals(application).started = true;

      expect(() => application.import.users(users)).toThrow(
        expect.objectContaining({ id: "plugin.runtime.already_started" }),
      );
    });
  });
});
