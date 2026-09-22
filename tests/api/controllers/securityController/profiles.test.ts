import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SecurityController from "../../../../lib/api/controllers/securityController";
import { KuzzleRequest } from "../../../../lib/api/request";
import { BadRequestError } from "../../../../lib/kerror/errors/badRequestError";
import { SizeLimitError } from "../../../../lib/kerror/errors/sizeLimitError";
import { Profile } from "../../../../lib/model/security/profile";
import { invalid } from "../../../helpers/invalid";
import { restoreKuzzle, stubKuzzle } from "../../../mocks/kuzzle";

describe("#api/controllers/securityController — profiles", () => {
  let controller: SecurityController;
  let request: KuzzleRequest;
  let profile: Profile;
  let getRights: ReturnType<typeof vi.fn>;
  let ask: ReturnType<typeof vi.fn>;
  let answers: Record<string, unknown>;
  let failures: Map<string, Error>;
  let internalIndex: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    profile = new Profile();
    profile._id = "fakeProfile";
    profile.policies = invalid<Profile["policies"]>("policies".split(""));
    profile.rateLimit = 123;
    getRights = vi.fn(async () => ({}));
    profile.getRights = getRights as unknown as Profile["getRights"];

    answers = {};
    failures = new Map();

    ask = vi.fn(async (event: string) => {
      const failure = failures.get(event);

      if (failure) {
        throw failure;
      }

      return answers[event];
    });

    /* The mapping actions go through the InternalIndexHandler, not the
     * `core:storage:private:mappings:*` events the Mocha spec asserted on. */
    internalIndex = {
      getMapping: vi.fn(async () => ({ properties: { foo: "bar" } })),
      refreshCollection: vi.fn(async () => undefined),
      updateMapping: vi.fn(
        async (collection: string, mappings: unknown) => mappings,
      ),
    };

    stubKuzzle({
      ask,
      internalIndex,
      pipe: async () => undefined,
      pluginsManager: { getStrategyMethod: () => undefined },
      config: { limits: { documentsFetchCount: 10000 } },
    });

    controller = new SecurityController();
    request = new KuzzleRequest(
      { controller: "security" },
      { user: { _id: "userId" } },
    );
  });

  afterEach(() => {
    restoreKuzzle();
  });

  const asked = (event: string) =>
    ask.mock.calls.filter(([name]) => name === event);

  const rejects = async (
    promise: Promise<unknown>,
    match: Record<string, unknown>,
    error: typeof BadRequestError | typeof SizeLimitError = BadRequestError,
  ) => {
    await expect(promise).rejects.toBeInstanceOf(error);
    await expect(promise).rejects.toMatchObject(match);
  };

  /** What a serialized profile looks like on the way out. */
  const serialized = {
    _id: "fakeProfile",
    _source: { policies: "policies".split(""), rateLimit: 123 },
  };

  describe("#updateProfileMapping", () => {
    it("should reject if the body is missing", async () => {
      /* `updateProfileMapping` is not `async`: it reads the body, then hands
       * back the handler's promise — so a missing body throws where it is
       * called rather than rejecting. Its `roles` sibling behaves the same. */
      expect(() => controller.updateProfileMapping(request)).toThrow(
        expect.objectContaining({ id: "api.assert.body_required" }),
      );

      expect(internalIndex.updateMapping).not.toHaveBeenCalled();
    });

    it("should update the profile mapping", async () => {
      request.input.body = { foo: "bar" };

      await expect(
        controller.updateProfileMapping(request),
      ).resolves.toMatchObject({ foo: "bar" });
      expect(internalIndex.updateMapping).toHaveBeenCalledWith("profiles", {
        foo: "bar",
      });
    });
  });

  describe("#getProfileMapping", () => {
    it("should answer the stored mapping", async () => {
      /* No argument: `getProfileMapping` takes none, and the Mocha spec
       * handed it the request — TS2554, as its `roles` twin did. */
      await expect(controller.getProfileMapping()).resolves.toMatchObject({
        mapping: { foo: "bar" },
      });
      expect(internalIndex.getMapping).toHaveBeenCalledWith("profiles");
    });
  });

  describe.each([
    ["createOrReplaceProfile", "core:security:profile:createOrReplace"],
    ["createProfile", "core:security:profile:create"],
  ] as const)("#%s", (action, event) => {
    beforeEach(() => {
      answers[event] = profile;
      request.input.args._id = "test";
      request.input.body = { policies: [{ roleId: "role1" }] };
    });

    it("should answer a serialized profile", async () => {
      const response = await controller[action](request);

      expect(asked(event)[0]).toEqual([
        event,
        "test",
        { policies: [{ roleId: "role1" }] },
        expect.objectContaining({ refresh: "wait_for", userId: "userId" }),
      ]);
      expect(response).not.toBeInstanceOf(Profile);
      expect(response).toMatchObject(serialized);
    });

    it("should forward a security module exception", async () => {
      const error = new Error("Mocked error");
      failures.set(event, error);

      await expect(controller[action](request)).rejects.toBe(error);
    });

    it.each([null, false, "false"])(
      "should read the refresh option %s as false",
      async (refresh) => {
        request.input.args.refresh = refresh;

        await controller[action](request);

        expect(asked(event)[0]?.[3]).toMatchObject({
          refresh: "false",
          userId: "userId",
        });
      },
    );

    it.each([null, undefined, false])(
      "should read the strict option %s as false",
      async (strict) => {
        request.input.args.strict = strict;

        await controller[action](request);

        expect(asked(event)[0]?.[3]).toMatchObject({ strict: false });
      },
    );

    it("should forward a strict option set to true", async () => {
      request.input.args.strict = true;

      await controller[action](request);

      expect(asked(event)[0]?.[3]).toMatchObject({ strict: true });
    });

    it("should reject a body that is missing", async () => {
      request.input.body = null;

      await rejects(controller[action](request), {
        id: "api.assert.body_required",
      });
      expect(asked(event)).toHaveLength(0);
    });

    it("should reject a body with no policies", async () => {
      request.input.body = {};

      await rejects(controller[action](request), {
        id: "api.assert.missing_argument",
        message: 'Missing argument "body.policies".',
      });
      expect(asked(event)).toHaveLength(0);
    });

    it("should reject policies that are not an array", async () => {
      request.input.body = { policies: "foobar" };

      await rejects(controller[action](request), {
        id: "api.assert.invalid_type",
        message: 'Wrong type for argument "body.policies" (expected: array)',
      });
      expect(asked(event)).toHaveLength(0);
    });

    it("should reject a missing _id", async () => {
      request.input.args._id = null;
      request.input.body = { policies: [] };

      await rejects(controller[action](request), {
        id: "api.assert.missing_argument",
        message: 'Missing argument "_id".',
      });
      expect(asked(event)).toHaveLength(0);
    });
  });

  describe("#getProfile", () => {
    const event = "core:security:profile:get";

    beforeEach(() => {
      request.input.args._id = "foobar";
      answers[event] = profile;
    });

    it("should answer a serialized profile", async () => {
      const response = await controller.getProfile(request);

      /*
       * The Mocha spec asserted `calledWithMatch(getStub, …)` — the stub
       * itself where the event name goes. sinon reads a function passed to
       * `match` as a CUSTOM MATCHER: it called the stub with the event name
       * and took its (always truthy) return value as a match. Four assertions
       * in this file were written that way, and none of them could fail.
       */
      expect(asked(event)[0]).toEqual([event, "foobar"]);
      expect(response).not.toBeInstanceOf(Profile);
      expect(response).toMatchObject(serialized);
    });

    it("should reject without an id", async () => {
      request.input.args._id = null;

      await rejects(controller.getProfile(request), {
        id: "api.assert.missing_argument",
      });
      expect(asked(event)).toHaveLength(0);
    });

    it("should forward a security module exception", async () => {
      const error = new Error("foobar");
      failures.set(event, error);

      await expect(controller.getProfile(request)).rejects.toBe(error);
    });
  });

  describe("#mGetProfiles", () => {
    const event = "core:security:profile:mGet";

    beforeEach(() => {
      request.input.body = { ids: "ids".split("") };
      answers[event] = [profile, profile, profile];
    });

    it("should answer one serialized profile per id", async () => {
      const response = await controller.mGetProfiles(request);

      expect(response.hits).toHaveLength(3);
      for (const hit of response.hits) {
        expect(hit).not.toBeInstanceOf(Profile);
        expect(hit).toMatchObject(serialized);
      }
    });

    it("should reject if no ids are provided", async () => {
      (request.input.body as Record<string, unknown>).ids = undefined;

      await rejects(controller.mGetProfiles(request), {
        id: "api.assert.missing_argument",
      });
      expect(asked(event)).toHaveLength(0);
    });

    it("should forward a security module exception", async () => {
      const error = new Error("Mocked error");
      failures.set(event, error);

      await expect(controller.mGetProfiles(request)).rejects.toBe(error);
      expect(asked(event)[0]).toEqual([event, request.input.body.ids]);
    });
  });

  describe("#searchProfiles", () => {
    const event = "core:security:profile:search";

    beforeEach(() => {
      answers[event] = { hits: [profile, profile, profile], total: 3 };
    });

    it("should search on the roles it is given", async () => {
      request.input.args.from = 13;
      request.input.args.size = 42;
      request.input.args.scroll = "duration";
      request.input.body = { roles: "roles".split("") };

      const response = await controller.searchProfiles(request);

      expect(asked(event)[0]).toEqual([
        event,
        { query: { terms: { "policies.roleId": "roles".split("") } } },
        { from: 13, size: 42, scroll: "duration" },
      ]);
      expect(response.total).toBe(3);
      expect(response.hits).toHaveLength(3);
      for (const hit of response.hits) {
        expect(hit).not.toBeInstanceOf(Profile);
        expect(hit).toMatchObject(serialized);
      }
    });

    it("should use the default options on an empty request", async () => {
      await controller.searchProfiles(request);

      expect(asked(event)[0]).toEqual([
        event,
        {},
        { from: 0, size: 10000, scroll: undefined },
      ]);
    });

    it("should reject a page size beyond the server limit", async () => {
      global.kuzzle.config.limits.documentsFetchCount = 1;
      request.input.args.from = 0;
      request.input.args.size = 10;

      await rejects(
        controller.searchProfiles(request),
        { id: "services.storage.get_limit_exceeded" },
        SizeLimitError,
      );
      expect(asked(event)).toHaveLength(0);
    });

    it("should forward a security module exception", async () => {
      const error = new Error("Mocked error");
      request.input.body = {};
      failures.set(event, error);

      await expect(controller.searchProfiles(request)).rejects.toBe(error);
    });
  });

  describe("#scrollProfiles", () => {
    const event = "core:security:profile:scroll";

    beforeEach(() => {
      answers[event] = {
        hits: [profile, profile, profile],
        scrollId: "foobar",
        total: 3,
      };
    });

    it("should reject if no scrollId is provided", async () => {
      await rejects(controller.scrollProfiles(request), {
        id: "api.assert.missing_argument",
        message: 'Missing argument "scrollId".',
      });
      expect(asked(event)).toHaveLength(0);
    });

    it("should answer the profiles and the next scroll id", async () => {
      request.input.args.scrollId = "barfoo";

      const response = await controller.scrollProfiles(request);

      expect(asked(event)[0]).toEqual([event, "barfoo", undefined]);
      expect(response.scrollId).toBe("foobar");
      expect(response.total).toBe(3);
      expect(response.hits).toHaveLength(3);
      for (const hit of response.hits) {
        expect(hit).not.toBeInstanceOf(Profile);
        expect(hit).toMatchObject(serialized);
      }
    });

    it("should handle the optional scroll argument", async () => {
      request.input.args.scroll = "42s";
      request.input.args.scrollId = "barfoo";

      await controller.scrollProfiles(request);

      expect(asked(event)[0]).toEqual([event, "barfoo", "42s"]);
    });
  });

  describe("#updateProfile", () => {
    const event = "core:security:profile:update";

    beforeEach(() => {
      answers[event] = profile;
      request.input.args._id = "profileId";
      request.input.body = { policies: "policies".split(""), rateLimit: 123 };
    });

    it("should update with the default options", async () => {
      const response = await controller.updateProfile(request);

      expect(asked(event)[0]?.[3]).toMatchObject({
        refresh: "wait_for",
        retryOnConflict: 10,
        userId: "userId",
      });
      expect(response).not.toBeInstanceOf(Profile);
      expect(response).toMatchObject(serialized);
    });

    it("should forward the provided options", async () => {
      request.input.args.refresh = false;
      request.input.args.retryOnConflict = 123;
      request.input.args.strict = true;

      await controller.updateProfile(request);

      expect(asked(event)[0]?.[3]).toMatchObject({
        refresh: "false",
        retryOnConflict: 123,
        strict: true,
        userId: "userId",
      });
    });

    it("should reject if no id is given", async () => {
      request.input.args._id = null;

      await rejects(controller.updateProfile(request), {
        id: "api.assert.missing_argument",
        message: 'Missing argument "_id".',
      });
      expect(asked(event)).toHaveLength(0);
    });

    it("should reject if no body is given", async () => {
      request.input.body = null;

      await rejects(controller.updateProfile(request), {
        id: "api.assert.body_required",
      });
    });

    it("should forward a security module exception", async () => {
      const error = new Error("foo");
      failures.set(event, error);

      await expect(controller.updateProfile(request)).rejects.toBe(error);
    });
  });

  describe("#deleteProfile", () => {
    const event = "core:security:profile:delete";

    beforeEach(() => {
      request.input.args._id = "profileId";
    });

    it("should answer the deleted identifier, with the default options", async () => {
      await expect(controller.deleteProfile(request)).resolves.toMatchObject({
        _id: "profileId",
      });
      // `onAssignedUsers` and `userId` too, which the Mocha spec's
      // prefix-matching assertion never mentioned.
      expect(asked(event)[0]).toEqual([
        event,
        "profileId",
        { onAssignedUsers: "fail", refresh: "wait_for", userId: "userId" },
      ]);
    });

    it("should forward a security module exception", async () => {
      const error = new Error("Mocked error");
      failures.set(event, error);

      await expect(controller.deleteProfile(request)).rejects.toBe(error);
    });

    it("should reject if no _id is provided", async () => {
      request.input.args._id = null;

      await rejects(controller.deleteProfile(request), {
        id: "api.assert.missing_argument",
        message: 'Missing argument "_id".',
      });
      expect(asked(event)).toHaveLength(0);
    });
  });

  describe("#getProfileRights", () => {
    const event = "core:security:profile:get";

    beforeEach(() => {
      request.input.args._id = "test";
      answers[event] = profile;
    });

    it("should answer the profile's rights", async () => {
      const rights = {
        rights1: {
          action: "action",
          collection: "bar",
          controller: "controller",
          index: "foo",
          value: "allowed",
        },
        rights2: {
          action: "*",
          collection: "*",
          controller: "*",
          index: "*",
          value: "denied",
        },
      };

      getRights.mockResolvedValue(rights);

      const response = await controller.getProfileRights(request);

      expect(asked(event)[0]).toEqual([event, "test"]);
      expect(response.hits).toEqual([rights.rights1, rights.rights2]);
    });

    it("should reject without an id", async () => {
      request.input.args._id = null;

      await rejects(controller.getProfileRights(request), {
        id: "api.assert.missing_argument",
        message: 'Missing argument "_id".',
      });
      expect(asked(event)).toHaveLength(0);
    });

    it("should forward a security module exception", async () => {
      const error = new Error("foo");
      failures.set(event, error);

      await expect(controller.getProfileRights(request)).rejects.toBe(error);
    });
  });

  describe("#mDeleteProfiles", () => {
    it("should forward to _mDelete and answer its result", async () => {
      const mDelete = vi
        .spyOn(
          controller as unknown as { _mDelete: () => Promise<string> },
          "_mDelete",
        )
        .mockResolvedValue("foobar");

      await expect(controller.mDeleteProfiles(request)).resolves.toBe("foobar");
      expect(mDelete).toHaveBeenCalledOnce();
      expect(mDelete).toHaveBeenCalledWith("profile", request);
    });
  });
});
