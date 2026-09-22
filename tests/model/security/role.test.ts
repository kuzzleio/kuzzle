import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Request } from "../../../lib/api/request/kuzzleRequest";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { Role } from "../../../lib/model/security/role";
import type { ControllerRights } from "../../../lib/types/controllers/ControllerRights";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

describe("#model/security/Role", () => {
  const context = { protocol: "test", userId: "-1" };
  const request = new Request(
    {
      index: "index",
      collection: "collection",
      controller: "controller",
      action: "action",
    },
    context,
  );

  let role: Role;

  beforeEach(() => {
    /*
     * `isActionAllowed` reads `global.kuzzle` for one thing only: whether it
     * exists at all — an un-initialized Role throws rather than answering a
     * permission question. The Mocha spec built the whole KuzzleMock for that
     * one truthiness test.
     */
    stubKuzzle();
    role = new Role();
  });

  afterEach(() => {
    restoreKuzzle();
  });

  describe("#isActionAllowed", () => {
    it("should throw when there is no application to answer for", () => {
      restoreKuzzle();

      expect(() => role.isActionAllowed(request)).toThrow(
        expect.objectContaining({ id: "security.role.uninitialized" }),
      );
    });

    it("should disallow any action when no matching entry can be found", () => {
      role.controllers = { controller: { actions: {} } };
      expect(role.isActionAllowed(request)).toBe(false);

      delete role.controllers.controller?.actions;
      expect(role.isActionAllowed(request)).toBe(false);

      delete role.controllers.controller;
      expect(role.isActionAllowed(request)).toBe(false);

      role.controllers = invalid<ControllerRights>(undefined);
      expect(role.isActionAllowed(request)).toBe(false);
    });

    it("should allow an action explicitly set to true", () => {
      role.controllers = { controller: { actions: { action: true } } };

      expect(role.isActionAllowed(request)).toBe(true);
    });

    // @deprecated
    it("should handle the memory storage controller aliases", () => {
      const msRequest = new Request({ controller: "ms", action: "time" });
      const memoryStorageRequest = new Request({
        controller: "memoryStorage",
        action: "time",
      });
      const forbiddenMsRequest = new Request({
        controller: "ms",
        action: "flushdb",
      });

      role.controllers = { ms: { actions: { time: true } } };

      expect(role.isActionAllowed(msRequest)).toBe(true);
      expect(role.isActionAllowed(memoryStorageRequest)).toBe(true);
      expect(role.isActionAllowed(forbiddenMsRequest)).toBe(false);

      delete role.controllers.ms;
      role.controllers.memoryStorage = { actions: { time: true } };

      expect(role.isActionAllowed(msRequest)).toBe(true);
      expect(role.isActionAllowed(memoryStorageRequest)).toBe(true);
      expect(role.isActionAllowed(forbiddenMsRequest)).toBe(false);
    });

    it("should allow a wildcard action", () => {
      role.controllers = { "*": { actions: { "*": true } } };

      expect(role.isActionAllowed(request)).toBe(true);
    });

    it("should allow an action on a controller with no restriction", () => {
      const req = new Request(
        { controller: "controller", action: "action" },
        context,
      );

      role.controllers = { controller: { actions: { action: true } } };

      expect(role.isActionAllowed(req)).toBe(true);
    });

    it("should properly handle overridden permissions", () => {
      role.controllers = {
        "*": { actions: { "*": true } },
        controller: { actions: { "*": false } },
      };

      expect(role.isActionAllowed(request)).toBe(false);

      role.controllers.controller.actions.action = true;
      expect(role.isActionAllowed(request)).toBe(true);

      role.controllers.controller.actions.action = false;
      expect(role.isActionAllowed(request)).toBe(false);
    });

    it("should reject if the rights configuration is not a boolean", () => {
      role.controllers = {
        "*": { actions: { "*": invalid<boolean>({ an: "object" }) } },
      };

      expect(role.isActionAllowed(request)).toBe(false);
    });
  });

  describe("#checkRestrictions", () => {
    const restrictions = new Map(
      Object.entries({
        index1: [],
        index2: ["collection1"],
        index3: ["collection1", "collection2"],
      }),
    );

    /*
     * The Mocha spec opened this with `checkRestrictions(req, restrictions)` —
     * a Request where an index goes, a Map where a collection goes, and no
     * third argument. With `restrictedTo` undefined the method returns `true`
     * before reading either, so the assertion held for any input at all. It is
     * a TS2345 here, and the seven calls below are the method's actual API.
     */
    it("should allow anything when the index carries no restriction", () => {
      // `collection` is declared `string`, and the guard on the next line of
      // the subject is what says a call may have none: the two call sites in
      // `profile`/`user` pass `request.input.args.collection`, absent on a
      // request that names no collection.
      expect(
        role.checkRestrictions(
          "index",
          invalid<string>(undefined),
          restrictions,
        ),
      ).toBe(false);

      expect(
        role.checkRestrictions(
          "index1",
          invalid<string>(undefined),
          restrictions,
        ),
      ).toBe(true);

      expect(
        role.checkRestrictions(
          "index2",
          invalid<string>(undefined),
          restrictions,
        ),
      ).toBe(true);
    });

    it("should match a collection against the restricted list", () => {
      expect(role.checkRestrictions("index2", "collection", restrictions)).toBe(
        false,
      );
      expect(
        role.checkRestrictions("index2", "collection1", restrictions),
      ).toBe(true);
      expect(
        role.checkRestrictions("index2", "collection2", restrictions),
      ).toBe(false);
      expect(
        role.checkRestrictions("index3", "collection2", restrictions),
      ).toBe(true);
    });
  });

  describe("#validateDefinition", () => {
    /** The rejection `validateDefinition` answers, or nothing. */
    const rejection = () => role.validateDefinition();

    it("should reject if the controllers definition is missing", async () => {
      role.controllers = invalid<ControllerRights>(undefined);

      await expect(rejection()).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection()).rejects.toMatchObject({
        id: "api.assert.missing_argument",
      });
    });

    it("should reject if the controllers definition is not an object", async () => {
      role.controllers = invalid<ControllerRights>(true);

      await expect(rejection()).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection()).rejects.toMatchObject({
        id: "api.assert.invalid_type",
      });
    });

    it("should reject if the controllers definition is empty", async () => {
      role.controllers = {};

      await expect(rejection()).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection()).rejects.toMatchObject({
        id: "api.assert.empty_argument",
      });
    });

    it("should reject if the controller element is not an object", async () => {
      role.controllers = { "*": invalid<ControllerRights[string]>(true) };

      await expect(rejection()).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection()).rejects.toMatchObject({
        id: "api.assert.invalid_type",
      });
    });

    it("should reject if the controller element is empty", async () => {
      role.controllers = { "*": invalid<ControllerRights[string]>({}) };

      await expect(rejection()).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection()).rejects.toMatchObject({
        id: "api.assert.empty_argument",
      });
    });

    it("should reject if the actions attribute is missing", async () => {
      role.controllers = {
        controller: invalid<ControllerRights[string]>({ a: true }),
      };

      await expect(rejection()).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection()).rejects.toMatchObject({
        id: "api.assert.missing_argument",
      });
    });

    it("should reject if the actions attribute is not an object", async () => {
      role.controllers = {
        controller: { actions: invalid<Record<string, boolean>>(true) },
      };

      await expect(rejection()).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection()).rejects.toMatchObject({
        id: "api.assert.invalid_type",
      });
    });

    it("should reject if the actions attribute is empty", async () => {
      role.controllers = { controller: { actions: {} } };

      await expect(rejection()).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection()).rejects.toMatchObject({
        id: "api.assert.empty_argument",
      });
    });

    it("should reject if an action right is neither a boolean nor an object", async () => {
      role.controllers = {
        controller: { actions: { action: invalid<boolean>(null) } },
      };

      await expect(rejection()).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection()).rejects.toMatchObject({
        id: "api.assert.invalid_type",
      });
    });

    it("should validate if only boolean rights are given", async () => {
      role.controllers = {
        controller1: { actions: { action1: false, action2: true } },
        controller2: { actions: { action3: true } },
      };

      await expect(rejection()).resolves.toBeUndefined();
    });
  });
});
