import type { JSONObject } from "kuzzle-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SecurityController from "../../../../lib/api/controllers/securityController";
import { KuzzleRequest } from "../../../../lib/api/request";
import { loadConfig } from "../../../../lib/config";
import { BadRequestError } from "../../../../lib/kerror/errors/badRequestError";
import { PluginImplementationError } from "../../../../lib/kerror/errors/pluginImplementationError";
import { PreconditionError } from "../../../../lib/kerror/errors/preconditionError";
import { SizeLimitError } from "../../../../lib/kerror/errors/sizeLimitError";
import * as kerror from "../../../../lib/kerror";
import { User } from "../../../../lib/model/security/user";
import { invalid } from "../../../helpers/invalid";
import { restoreKuzzle, stubKuzzle, stubLogger } from "../../../mocks/kuzzle";

/**
 * `anonymousId` and `getStrategyMethod` are `protected` on the controller and
 * the spec drives both: the first is what `getUserStrategies` compares against,
 * the second is what every credentials path goes through. Named once here
 * rather than cast at each of the twelve sites — the same convention the
 * `hotelClerk` and `pluginRepository` ports settled on.
 */
type Internals = {
  anonymousId: string | null;
  _persistUser: SecurityController["_persistUser"];
  _mDelete: (type: string, request: KuzzleRequest) => Promise<unknown>;
  restrictDefaultRights: SecurityController["restrictDefaultRights"];
  translateKoncorde: (query: unknown) => Promise<unknown>;
};

const internalsOf = (controller: SecurityController) =>
  invalid<Internals>(controller);

describe("#api/controllers/securityController — users", () => {
  let controller: SecurityController;
  let request: KuzzleRequest;
  let ask: ReturnType<typeof vi.fn>;
  /** event -> the answer, or a function of the remaining `ask` arguments. */
  let answers: Record<string, unknown>;
  let failures: Map<string, Error>;
  let internalIndex: Record<string, ReturnType<typeof vi.fn>>;
  let listStrategies: ReturnType<typeof vi.fn>;
  let strategyMethods: Map<string, ReturnType<typeof vi.fn>>;
  let getStrategyMethod: ReturnType<typeof vi.fn>;
  let config: ReturnType<typeof loadConfig>;
  let logger: ReturnType<typeof stubLogger>;

  /** Registers the method a strategy answers for one of its hooks. */
  const strategy = (
    name: string,
    hook: string,
    impl: (...args: never[]) => unknown,
  ) => {
    const stub = vi.fn(impl);

    strategyMethods.set(`${name}:${hook}`, stub);

    return stub;
  };

  beforeEach(() => {
    answers = {};
    failures = new Map();

    ask = vi.fn(async (event: string, ...args: unknown[]) => {
      const failure = failures.get(event);

      if (failure) {
        throw failure;
      }

      const answer = answers[event];

      return typeof answer === "function" ? answer(...args) : answer;
    });

    /* The mapping actions go through the InternalIndexHandler, not the
     * `core:storage:private:mappings:*` events the Mocha spec asserted on. */
    internalIndex = {
      getMapping: vi.fn(async () => ({ properties: { foo: "bar" } })),
      updateMapping: vi.fn(
        async (collection: string, mappings: unknown) => mappings,
      ),
    };

    strategyMethods = new Map();
    listStrategies = vi.fn(() => [] as string[]);
    getStrategyMethod = vi.fn((name: string, hook: string) =>
      strategyMethods.get(`${name}:${hook}`),
    );

    /* `restrictDefaultRights` iterates `config.security.standard`, and what it
     * must reproduce is the shipped default — not a fixture that would agree
     * with the assertion by construction. */
    /* `loadConfig()` answers a shared object, so a test that pins a limit or a
     * restricted profile would leak into the next one. `KuzzleMock` deep-cloned
     * it for the same reason. */
    config = JSON.parse(JSON.stringify(loadConfig()));
    logger = stubLogger();

    stubKuzzle({
      ask,
      config,
      internalIndex,
      log: logger,
      pipe: async () => undefined,
      pluginsManager: { getStrategyMethod, listStrategies },
    });

    controller = new SecurityController();
    internalsOf(controller).anonymousId = "-1";

    request = new KuzzleRequest(
      { controller: "security" },
      // Random number chosen by fair dice roll. Guaranteed to be random.
      // (xkcd #221)
      { user: invalid<User>({ _id: "4" }) },
    );
  });

  afterEach(() => {
    restoreKuzzle();
    vi.restoreAllMocks();
  });

  const asked = (event: string) =>
    ask.mock.calls.filter(([name]) => name === event);

  const rejects = async (
    promise: Promise<unknown>,
    match: Record<string, unknown>,
    error:
      | typeof BadRequestError
      | typeof PluginImplementationError
      | typeof PreconditionError
      | typeof SizeLimitError = BadRequestError,
  ) => {
    await expect(promise).rejects.toBeInstanceOf(error);
    await expect(promise).rejects.toMatchObject(match);
  };

  describe("#checkRights", () => {
    let isActionAllowed: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      isActionAllowed = vi.fn(async () => true);
      answers["core:security:user:get"] = { isActionAllowed };

      request.input.args.userId = "melis";
      request.input.body = { action: "create", controller: "document" };
    });

    it("should check if the action is allowed for the provided userId", async () => {
      await expect(controller.checkRights(request)).resolves.toEqual({
        allowed: true,
      });

      expect(ask).toHaveBeenCalledWith("core:security:user:get", "melis");

      expect(isActionAllowed).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            action: "create",
            controller: "document",
          }),
        }),
      );
    });

    it("should reject if the provided request is not valid", async () => {
      request.input.body.controller = null;

      await rejects(controller.checkRights(request), {
        id: "api.assert.missing_argument",
      });

      request.input.body.controller = "document";
      request.input.body.action = null;

      await rejects(controller.checkRights(request), {
        id: "api.assert.missing_argument",
      });
    });
  });

  // aka "The Big One"
  describe("#persistUser", () => {
    const createEvent = "core:security:user:create";
    const deleteEvent = "core:security:user:delete";
    const content = { foo: "bar" };
    const profileIds = ["foo"];

    let fakeUser: User;
    let strategyCreate: ReturnType<typeof vi.fn>;
    let strategyExists: ReturnType<typeof vi.fn>;
    let strategyValidate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      request.input.args._id = "test";
      request.input.body = {
        content: { name: "John Doe", profileIds },
        credentials: { someStrategy: { some: "credentials" } },
      };

      listStrategies.mockReturnValue(["someStrategy"]);

      fakeUser = new User();
      fakeUser._id = "test";

      answers[createEvent] = fakeUser;
      answers[deleteEvent] = undefined;

      strategyCreate = strategy(
        "someStrategy",
        "create",
        async () => undefined,
      );
      strategyExists = strategy("someStrategy", "exists", async () => false);
      strategyValidate = strategy(
        "someStrategy",
        "validate",
        async () => undefined,
      );
    });

    const persist = () =>
      internalsOf(controller)._persistUser(request, profileIds, content);

    it("should reject if a strategy is unknown", async () => {
      listStrategies.mockReturnValue(["oops"]);

      await rejects(persist(), {
        id: "security.credentials.unknown_strategy",
      });

      expect(asked(createEvent)).toHaveLength(0);
      expect(asked(deleteEvent)).toHaveLength(0);
    });

    it("should reject if credentials already exist on the provided user id", async () => {
      strategyExists.mockResolvedValue(true);

      await rejects(
        persist(),
        { id: "security.credentials.database_inconsistency" },
        PluginImplementationError,
      );

      expect(asked(createEvent)).toHaveLength(0);
      expect(asked(deleteEvent)).toHaveLength(0);
    });

    it("should rollback if credentials don't validate the strategy", async () => {
      strategyValidate.mockRejectedValue(new Error("error"));

      await rejects(persist(), { id: "security.credentials.rejected" });

      expect(ask).toHaveBeenCalledWith(
        createEvent,
        "test",
        profileIds,
        content,
        { refresh: "wait_for" },
      );

      expect(ask).toHaveBeenCalledWith(deleteEvent, "test", {
        refresh: "false",
      });
    });

    it("should reject and rollback if credentials don't create properly", async () => {
      strategyCreate.mockRejectedValue(new Error("some error"));

      await rejects(
        persist(),
        { id: "plugin.runtime.unexpected_error" },
        PluginImplementationError,
      );

      expect(ask).toHaveBeenCalledWith(deleteEvent, "test", {
        refresh: "false",
      });
    });

    it("should not create credentials if user creation fails", async () => {
      const error = new Error("error");

      failures.set(createEvent, error);

      await expect(persist()).rejects.toBe(error);

      expect(strategyCreate).not.toHaveBeenCalled();
    });

    it("should intercept errors during deletion of a rollback phase", async () => {
      // "foo" is listed before "someStrategy", so it is the one whose `create`
      // fails; "someStrategy" is the one already created, whose rollback
      // `delete` then fails too. Both messages must reach the thrown error.
      listStrategies.mockReturnValue(["someStrategy", "foo"]);

      const strategyDelete = strategy("someStrategy", "delete", async () => {
        throw new Error("someStrategy delete error");
      });

      strategy("foo", "validate", async () => undefined);
      strategy("foo", "exists", async () => false);
      strategy("foo", "create", async () => {
        throw new Error("oh noes");
      });

      request.input.body.credentials.foo = { firstname: "X Æ A-12" };

      await rejects(
        persist(),
        {
          id: "plugin.runtime.unexpected_error",
          message: expect.stringMatching(
            /oh noes\nsomeStrategy delete error/,
          ) as unknown as string,
        },
        PluginImplementationError,
      );

      expect(strategyDelete).toHaveBeenCalledWith(
        request,
        "test",
        "someStrategy",
      );
    });

    it("should return the plugin error if it threw a KuzzleError error", async () => {
      const error = new BadRequestError("foo");

      strategyValidate.mockRejectedValue(error);

      await expect(persist()).rejects.toBe(error);

      strategyValidate.mockResolvedValue(undefined);
      strategyCreate.mockRejectedValue(error);

      await expect(persist()).rejects.toBe(error);
    });
  });

  describe("#updateUserMapping", () => {
    const foo = { foo: "bar" };

    it("should reject if the body is missing", async () => {
      await rejects(controller.updateUserMapping(request), {
        id: "api.assert.body_required",
      });

      expect(internalIndex.updateMapping).not.toHaveBeenCalled();
    });

    it("should update the user mapping", async () => {
      request.input.body = foo;

      await expect(
        controller.updateUserMapping(request),
      ).resolves.toMatchObject(foo);

      // The Mocha spec asserted `core:storage:private:mappings:update`, which
      // `KuzzleMock`'s real InternalIndexHandler emits one layer below.
      expect(internalIndex.updateMapping).toHaveBeenCalledWith("users", foo);
    });
  });

  describe("#getUserMapping", () => {
    it("should fulfill with a response object", async () => {
      // `getUserMapping()` takes no argument; the Mocha spec handed it the
      // request, as its `profiles` and `roles` siblings did.
      await expect(controller.getUserMapping()).resolves.toMatchObject({
        mapping: { foo: "bar" },
      });

      expect(internalIndex.getMapping).toHaveBeenCalledWith("users");
    });
  });

  describe("#getUser", () => {
    it("should reject if no id is given", async () => {
      await rejects(controller.getUser(request), {
        id: "api.assert.missing_argument",
      });
    });

    it("should load and return the requested user", async () => {
      const user = new User();

      user._id = "foo";
      invalid<JSONObject>(user).bar = "baz";

      request.input.args._id = "foo";
      answers["core:security:user:get"] = user;

      await expect(controller.getUser(request)).resolves.toMatchObject({
        _id: "foo",
        _source: { bar: "baz" },
      });

      expect(ask).toHaveBeenCalledWith("core:security:user:get", "foo");
    });

    it("should forward errors from the security module", async () => {
      const error = new Error("oh noes");

      request.input.args._id = "foo";
      failures.set("core:security:user:get", error);

      await expect(controller.getUser(request)).rejects.toBe(error);
    });
  });

  describe("#mGetUsers", () => {
    const mGetEvent = "core:security:user:mGet";
    const expectedHits = [
      { _id: "foo", _source: { profileIds: [] } },
      { _id: "bar", _source: { profileIds: [] } },
      { _id: "baz", _source: { profileIds: [] } },
    ];

    beforeEach(() => {
      request.input.body = { ids: ["foo", "bar"] };

      answers[mGetEvent] = ["foo", "bar", "baz"].map((id) => {
        const user = new User();

        user._id = id;

        return user;
      });
    });

    it("should reject if no ids are given", async () => {
      delete request.input.body.ids;

      await rejects(controller.mGetUsers(request), {
        id: "api.assert.missing_argument",
        message: 'Missing argument "ids".',
      });

      expect(asked(mGetEvent)).toHaveLength(0);
    });

    it("should return a valid response", async () => {
      await expect(controller.mGetUsers(request)).resolves.toMatchObject({
        hits: expectedHits,
      });

      expect(ask).toHaveBeenCalledWith(mGetEvent, ["foo", "bar"]);
    });

    it("should accept ids given as an args string", async () => {
      request.input.body = null;
      request.input.args.ids = "user1,user2";

      await expect(controller.mGetUsers(request)).resolves.toMatchObject({
        hits: expectedHits,
      });

      expect(ask).toHaveBeenCalledWith(mGetEvent, ["user1", "user2"]);
    });
  });

  describe("#searchUsers", () => {
    const searchEvent = "core:security:user:search";

    beforeEach(() => {
      request.input.body = { query: { foo: "bar" } };
      request.input.args.from = 13;
      request.input.args.size = 42;
      request.input.args.scroll = "foo";

      answers[searchEvent] = {
        hits: [{ _id: "admin", _source: { profileIds: ["admin"] } }],
        scrollId: "foobar",
        total: 2,
      };
    });

    const expectedResponse = {
      hits: [{ _id: "admin" }],
      scrollId: "foobar",
      total: 2,
    };

    it("should return a valid responseObject", async () => {
      await expect(controller.searchUsers(request)).resolves.toMatchObject(
        expectedResponse,
      );

      expect(ask).toHaveBeenCalledWith(
        searchEvent,
        { query: { foo: "bar" } },
        { from: 13, scroll: "foo", size: 42 },
      );
    });

    it("should handle empty body requests", async () => {
      await expect(
        controller.searchUsers(new KuzzleRequest({}, {})),
      ).resolves.toMatchObject(expectedResponse);

      expect(ask).toHaveBeenCalledWith(
        searchEvent,
        {},
        // `size` defaults to the `documentsFetchCount` limit, not to 10.
        { from: 0, scroll: undefined, size: config.limits.documentsFetchCount },
      );
    });

    it("should allow `aggregations` and `highlight` arguments", async () => {
      const options = { from: 13, scroll: "foo", size: 42 };

      request.input.body = { aggregations: "aggregations" };
      await controller.searchUsers(request);

      expect(ask).toHaveBeenCalledWith(
        searchEvent,
        { aggregations: "aggregations" },
        options,
      );

      ask.mockClear();
      request.input.body = { highlight: "highlight" };
      await controller.searchUsers(request);

      expect(ask).toHaveBeenCalledWith(
        searchEvent,
        { highlight: "highlight" },
        options,
      );

      ask.mockClear();
      request.input.body = {
        aggregations: "aggregations",
        highlight: "highlight",
        query: { match_all: {} },
      };
      await controller.searchUsers(request);

      expect(ask).toHaveBeenCalledWith(
        searchEvent,
        {
          aggregations: "aggregations",
          highlight: "highlight",
          query: { match_all: {} },
        },
        options,
      );
    });

    it("should reject if the number of documents per page exceeds server limits", async () => {
      config.limits.documentsFetchCount = 1;

      await rejects(
        controller.searchUsers(new KuzzleRequest({ size: 10 }, {})),
        { id: "services.storage.get_limit_exceeded" },
        SizeLimitError,
      );
    });

    it("should forward a security module exception", async () => {
      const error = new Error("Mocked error");

      failures.set(searchEvent, error);

      await expect(controller.searchUsers(request)).rejects.toBe(error);
    });

    it('should reject if the "lang" is not supported', async () => {
      request.input.args.lang = "turkish";

      await rejects(controller.searchUsers(request), {
        id: "api.assert.invalid_argument",
      });
    });

    it('should call the "translateKoncorde" method if "lang" is "koncorde"', async () => {
      request.input.body = { query: { equals: { name: "Melis" } } };
      request.input.args.lang = "koncorde";

      const translate = vi
        .spyOn(internalsOf(controller), "translateKoncorde")
        .mockResolvedValue(undefined);

      await controller.searchUsers(request);

      expect(translate).toHaveBeenCalledWith({ equals: { name: "Melis" } });
    });
  });

  describe("#scrollUsers", () => {
    const scrollEvent = "core:security:user:scroll";

    beforeEach(() => {
      request.input.args.scrollId = "foobar";

      answers[scrollEvent] = () => ({
        hits: [{ _id: "admin", _source: { profileIds: ["admin"] } }],
        scrollId: "foobar",
        total: 2,
      });
    });

    it("should reject if no scrollId is provided", async () => {
      delete request.input.args.scrollId;

      await rejects(controller.scrollUsers(request), {
        id: "api.assert.missing_argument",
      });
    });

    it("should reformat search results correctly", async () => {
      await expect(controller.scrollUsers(request)).resolves.toMatchObject({
        hits: [{ _id: "admin" }],
        scrollId: "foobar",
        total: 2,
      });

      expect(ask).toHaveBeenCalledWith(scrollEvent, "foobar", undefined);
    });

    it("should handle the scroll argument", async () => {
      request.input.args.scroll = "qux";

      await expect(controller.scrollUsers(request)).resolves.toMatchObject({
        hits: [{ _id: "admin" }],
        scrollId: "foobar",
        total: 2,
      });

      expect(ask).toHaveBeenCalledWith(scrollEvent, "foobar", "qux");
    });
  });

  describe("#deleteUser", () => {
    const deleteEvent = "core:security:user:delete";

    beforeEach(() => {
      request.input.args._id = "test";
      answers[deleteEvent] = undefined;
    });

    it("should return a valid response", async () => {
      await expect(controller.deleteUser(request)).resolves.toEqual({
        _id: "test",
      });

      expect(ask).toHaveBeenCalledWith(deleteEvent, "test", {
        refresh: "wait_for",
      });
    });

    it("should reject if no id is given", async () => {
      request.input.args._id = null;

      await rejects(controller.deleteUser(request), {
        id: "api.assert.missing_argument",
        message: 'Missing argument "_id".',
      });

      expect(asked(deleteEvent)).toHaveLength(0);
    });

    it("should forward exceptions from the security module", async () => {
      const error = new Error("Mocked error");

      failures.set(deleteEvent, error);

      await expect(
        controller.deleteUser(new KuzzleRequest({ _id: "test" }, {})),
      ).rejects.toBe(error);
    });

    it("should handle the refresh option", async () => {
      request.input.args.refresh = false;

      await controller.deleteUser(request);

      expect(ask).toHaveBeenCalledWith(deleteEvent, "test", {
        refresh: "false",
      });
    });
  });

  describe("#createUser", () => {
    // `_persistUser` has its own extensive tests above
    const createdUser = { _id: "foo", _source: { bar: "baz" } };
    let persistUser: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      persistUser = vi
        .spyOn(internalsOf(controller), "_persistUser")
        .mockResolvedValue(createdUser);

      request.input.args._id = "test";
      request.input.body = {
        content: { name: "John Doe", profileIds: ["default"] },
      };
    });

    it("should return a valid response", async () => {
      await expect(controller.createUser(request)).resolves.toEqual(
        createdUser,
      );

      expect(persistUser).toHaveBeenCalledOnce();
      // The fourth argument is the one the Mocha spec's prefix-match dropped.
      expect(persistUser).toHaveBeenCalledWith(
        request,
        ["default"],
        { name: "John Doe", profileIds: ["default"] },
        { humanReadableId: true },
      );
    });

    it("should reject if no body is provided", async () => {
      request.input.body = null;

      await rejects(controller.createUser(request), {
        id: "api.assert.body_required",
      });

      expect(persistUser).not.toHaveBeenCalled();
    });

    it("should reject if no profileId is given", async () => {
      delete request.input.body.content.profileIds;

      await rejects(controller.createUser(request), {
        id: "api.assert.missing_argument",
        message: 'Missing argument "body.content.profileIds".',
      });

      expect(persistUser).not.toHaveBeenCalled();
    });

    it("should reject if profileIds is not an array", async () => {
      request.input.body.content.profileIds = {};

      await rejects(controller.createUser(request), {
        id: "api.assert.invalid_type",
        message:
          'Wrong type for argument "body.content.profileIds" (expected: array)',
      });

      expect(persistUser).not.toHaveBeenCalled();
    });
  });

  describe("#createRestrictedUser", () => {
    const createdUser = { _id: "foo", _source: { bar: "baz" } };
    let persistUser: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      persistUser = vi
        .spyOn(internalsOf(controller), "_persistUser")
        .mockResolvedValue(createdUser);

      request.input.args._id = "test";
      request.input.body = { content: { name: "John Doe" } };

      config.security.restrictedProfileIds = ["foo", "bar"];
    });

    it("should return a valid response", async () => {
      await expect(controller.createRestrictedUser(request)).resolves.toEqual(
        createdUser,
      );

      expect(persistUser).toHaveBeenCalledOnce();
      expect(persistUser).toHaveBeenCalledWith(
        request,
        ["foo", "bar"],
        { name: "John Doe" },
        { humanReadableId: true },
      );

      expect(persistUser.mock.calls[0][2]).not.toHaveProperty("profileIds");
    });

    it("should reject if profileIds are given", async () => {
      request.input.body.content.profileIds = ["ohnoes"];

      await rejects(controller.createRestrictedUser(request), {
        id: "api.assert.forbidden_argument",
        message:
          'The argument "body.content.profileIds" is not allowed by this API action.',
      });

      expect(persistUser).not.toHaveBeenCalled();
    });

    it("should allow the request to not have a body content", async () => {
      request.input.body = null;

      await expect(controller.createRestrictedUser(request)).resolves.toEqual(
        createdUser,
      );

      expect(persistUser).toHaveBeenCalledOnce();
      expect(persistUser).toHaveBeenCalledWith(
        request,
        ["foo", "bar"],
        {},
        {
          humanReadableId: true,
        },
      );

      expect(persistUser.mock.calls[0][2]).not.toHaveProperty("profileIds");
    });
  });

  describe("#updateUser", () => {
    const updateEvent = "core:security:user:update";
    let updatedUser: User;

    beforeEach(() => {
      request.input.args._id = "test";
      request.input.body = { foo: "bar" };

      updatedUser = new User();
      updatedUser._id = "test";

      answers[updateEvent] = () => updatedUser;
    });

    it("should return a valid response and use default options", async () => {
      Object.assign(updatedUser, { baz: "qux", foo: "bar" });

      const response = await controller.updateUser(request);

      expect(ask).toHaveBeenCalledWith(
        updateEvent,
        "test",
        null,
        { foo: "bar" },
        { refresh: "wait_for", retryOnConflict: 10, userId: "4" },
      );

      expect(response).not.toBeInstanceOf(User);
      expect(response).toMatchObject({
        _id: "test",
        _source: { baz: "qux", foo: "bar" },
      });
    });

    it("should reject if no id is given", async () => {
      request.input.args._id = null;

      await rejects(controller.updateUser(request), {
        id: "api.assert.missing_argument",
        message: 'Missing argument "_id".',
      });

      expect(asked(updateEvent)).toHaveLength(0);
    });

    it("should reject if no body is provided", async () => {
      request.input.body = null;

      await rejects(controller.updateUser(request), {
        id: "api.assert.body_required",
      });

      expect(asked(updateEvent)).toHaveLength(0);
    });

    it("should forward the provided options to the security module", async () => {
      request.input.args.refresh = false;
      request.input.args.retryOnConflict = 123;

      await controller.updateUser(request);

      expect(ask).toHaveBeenCalledWith(
        updateEvent,
        "test",
        null,
        { foo: "bar" },
        { refresh: "false", retryOnConflict: 123, userId: "4" },
      );
    });

    it("should reject if the security module throws", async () => {
      const error = new Error("foo");

      failures.set(updateEvent, error);

      await expect(controller.updateUser(request)).rejects.toBe(error);
    });
  });

  describe("#upsertUser", () => {
    const updateEvent = "core:security:user:update";

    beforeEach(() => {
      request.input.args._id = "test";
      request.input.body = {
        content: { name: "John Doe", profileIds: ["default"] },
      };
    });

    /** What `core:security:user:update` answers when the user is absent. */
    const notFound = () =>
      failures.set(
        updateEvent,
        kerror.get("security", "user", "not_found", "test"),
      );

    it("should create a user if it did not exist", async () => {
      const created = { _id: "test", _source: request.input.body.content };

      const persistUser = vi
        .spyOn(internalsOf(controller), "_persistUser")
        .mockResolvedValue(created);

      notFound();

      await expect(controller.upsertUser(request)).resolves.toEqual(created);

      expect(persistUser).toHaveBeenCalledOnce();
      expect(persistUser).toHaveBeenCalledWith(request, ["default"], {
        name: "John Doe",
        profileIds: ["default"],
      });
    });

    it("should create a user if it did not exist and assign default values", async () => {
      const credentials = {
        local: { password: "password", username: "username" },
      };

      request.input.body.default = { city: "Montpellier", credentials };

      const created = {
        _id: "test",
        _source: {
          ...request.input.body.default,
          ...request.input.body.content,
        },
      };

      const persistUser = vi
        .spyOn(internalsOf(controller), "_persistUser")
        .mockResolvedValue(created);

      notFound();

      await expect(controller.upsertUser(request)).resolves.toEqual(created);

      expect(persistUser).toHaveBeenCalledOnce();
      expect(persistUser).toHaveBeenCalledWith(request, ["default"], {
        city: "Montpellier",
        credentials,
        name: "John Doe",
        profileIds: ["default"],
      });
    });

    it("should update a user if it already exist", async () => {
      request.input.body = {
        content: { foo: "bar", profileIds: ["default"] },
      };

      const existing = new User();

      existing._id = "test";
      existing.profileIds = ["default"];

      const updated = Object.assign(new User(), existing, {
        foo: "bar",
      });

      answers["core:security:user:get"] = existing;
      answers[updateEvent] = () => updated;

      const response = await controller.upsertUser(request);

      expect(ask).toHaveBeenCalledWith(
        updateEvent,
        "test",
        ["default"],
        { foo: "bar", profileIds: ["default"] },
        { refresh: "wait_for", retryOnConflict: 10, userId: "4" },
      );

      expect(response).not.toBeInstanceOf(User);
      expect(response).toMatchObject({
        _id: "test",
        _source: { foo: "bar", profileIds: ["default"] },
      });
    });
  });

  describe("#replaceUser", () => {
    const replaceEvent = "core:security:user:replace";
    let replacedUser: User;

    beforeEach(() => {
      request.input.args._id = "test";
      request.input.body = { foo: "bar", profileIds: ["qux"] };

      replacedUser = new User();

      answers[replaceEvent] = () => replacedUser;
    });

    it("should reject if the request does not have a body", async () => {
      request.input.body = null;

      await rejects(controller.replaceUser(request), {
        id: "api.assert.body_required",
      });

      expect(asked(replaceEvent)).toHaveLength(0);
    });

    it("should reject if there is no id provided", async () => {
      request.input.args._id = null;

      await rejects(controller.replaceUser(request), {
        id: "api.assert.missing_argument",
      });

      expect(asked(replaceEvent)).toHaveLength(0);
    });

    it("should reject if the content does not have a profileIds attribute", async () => {
      delete request.input.body.profileIds;

      await rejects(controller.replaceUser(request), {
        id: "api.assert.missing_argument",
      });
    });

    it("should reject if the provided profileIds attribute is not an array", async () => {
      request.input.body.profileIds = {};

      await rejects(controller.replaceUser(request), {
        id: "api.assert.invalid_type",
      });
    });

    it("should reject if the security module throws", async () => {
      const error = new Error("foo");

      failures.set(replaceEvent, error);

      await expect(controller.replaceUser(request)).rejects.toBe(error);
    });

    it("should correctly process the request", async () => {
      Object.assign(replacedUser, {
        _id: "test",
        baz: "qux",
        foo: "bar",
        profileIds: ["qux"],
      });

      const response = await controller.replaceUser(request);

      expect(ask).toHaveBeenCalledWith(
        replaceEvent,
        "test",
        ["qux"],
        { foo: "bar", profileIds: ["qux"] },
        { refresh: "wait_for", userId: "4" },
      );

      expect(response).not.toBeInstanceOf(User);
      expect(response).toMatchObject({
        _id: "test",
        _source: { baz: "qux", foo: "bar", profileIds: ["qux"] },
      });
    });

    it("should handle request options", async () => {
      request.input.args.refresh = false;

      await controller.replaceUser(request);

      expect(ask).toHaveBeenCalledWith(
        replaceEvent,
        "test",
        ["qux"],
        { foo: "bar", profileIds: ["qux"] },
        { refresh: "false", userId: "4" },
      );
    });
  });

  describe("#getUserStrategies", () => {
    const getEvent = "core:security:user:get";
    const exampleStrategy = "someStrategy";

    beforeEach(() => {
      request.input.args._id = "test";

      const returnedUser = new User();

      returnedUser._id = "test";
      answers[getEvent] = returnedUser;

      listStrategies.mockReturnValue([exampleStrategy]);
      strategy(exampleStrategy, "exists", async () => true);
    });

    it("should return a list of strategies", async () => {
      await expect(controller.getUserStrategies(request)).resolves.toEqual({
        strategies: [exampleStrategy],
        total: 1,
      });
    });

    it("should return empty when anonymous id is provided", async () => {
      request.input.args._id = "-1";

      await expect(controller.getUserStrategies(request)).resolves.toEqual({
        strategies: [],
        total: 0,
      });
    });

    it("should reject if user is not found", async () => {
      const error = new Error("foo");

      request.input.args._id = "alyx";
      failures.set(getEvent, error);

      await expect(controller.getUserStrategies(request)).rejects.toBe(error);
    });

    it("should reject if no id is provided", async () => {
      request.input.args._id = null;

      await rejects(controller.getUserStrategies(request), {
        id: "api.assert.missing_argument",
        message: 'Missing argument "_id".',
      });

      expect(asked(getEvent)).toHaveLength(0);
    });
  });

  describe("#getUserRights", () => {
    const getEvent = "core:security:user:get";
    let getRights: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      request.input.args._id = "test";

      const returnedUser = new User();

      returnedUser._id = "test";
      getRights = vi.fn(async () => ({}));
      returnedUser.getRights = getRights as unknown as User["getRights"];

      answers[getEvent] = returnedUser;
    });

    it("should resolve to an object on a getUserRights call", async () => {
      const rights = {
        rights1: {
          action: "action",
          collection: "foo",
          controller: "controller",
          index: "index",
          value: true,
        },
        rights2: {
          action: "action",
          collection: "collection",
          controller: "bar",
          index: "index",
          value: false,
        },
      };

      getRights.mockResolvedValue(rights);

      const response = await controller.getUserRights(request);

      expect(ask).toHaveBeenCalledWith(getEvent, "test");

      expect(response.total).toBe(2);
      expect(response.hits).toEqual([rights.rights1, rights.rights2]);
    });

    it("should reject if no id is provided", async () => {
      request.input.args._id = null;

      await rejects(controller.getUserRights(request), {
        id: "api.assert.missing_argument",
        message: 'Missing argument "_id".',
      });

      expect(asked(getEvent)).toHaveLength(0);
    });

    it("should forward a security module exception", async () => {
      const error = new Error("foo");

      failures.set(getEvent, error);

      await expect(controller.getUserRights(request)).rejects.toBe(error);
    });
  });

  describe("#mDeleteUser", () => {
    it("should forward its args to mDelete", async () => {
      const mDelete = vi
        .spyOn(internalsOf(controller), "_mDelete")
        .mockResolvedValue("foobar");

      await expect(controller.mDeleteUsers(request)).resolves.toBe("foobar");

      expect(mDelete).toHaveBeenCalledOnce();
      expect(mDelete).toHaveBeenCalledWith("user", request);
    });
  });

  describe("#revokeTokens", () => {
    const revokeEvent = "core:security:token:deleteByKuid";

    beforeEach(() => {
      request.input.args._id = "test";
    });

    it("should revoke all tokens related to a given user", async () => {
      await expect(controller.revokeTokens(request)).resolves.toBeNull();

      expect(ask).toHaveBeenCalledWith(revokeEvent, "test");
    });

    it("should reject if no id is provided", async () => {
      request.input.args._id = null;

      await rejects(controller.revokeTokens(request), {
        id: "api.assert.missing_argument",
      });

      expect(asked(revokeEvent)).toHaveLength(0);
    });

    it("should forward security module exceptions", async () => {
      const error = new Error("foo");

      failures.set(revokeEvent, error);

      await expect(controller.revokeTokens(request)).rejects.toBe(error);
    });
  });

  describe("#createFirstAdmin", () => {
    const adminExistsEvent = "core:security:user:admin:exist";
    let persistUser: ReturnType<typeof vi.spyOn>;
    let restrict: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      persistUser = vi
        .spyOn(internalsOf(controller), "_persistUser")
        .mockResolvedValue(undefined);
      restrict = vi
        .spyOn(internalsOf(controller), "restrictDefaultRights")
        .mockResolvedValue(undefined);

      request.input.args._id = "test";
      answers[adminExistsEvent] = false;
    });

    it("should reject if an admin already exists", async () => {
      answers[adminExistsEvent] = true;

      await rejects(
        controller.createFirstAdmin(request),
        { id: "api.process.admin_exists" },
        PreconditionError,
      );

      expect(persistUser).not.toHaveBeenCalled();
      expect(restrict).not.toHaveBeenCalled();
    });

    it("should create the admin user and not reset roles & profiles if not asked to", async () => {
      request.input.body = { content: { foo: "bar" } };

      await controller.createFirstAdmin(request);

      expect(persistUser).toHaveBeenCalledOnce();
      expect(persistUser).toHaveBeenCalledWith(
        request,
        ["admin"],
        { foo: "bar" },
        { humanReadableId: true },
      );

      expect(restrict).not.toHaveBeenCalled();
    });

    it("should create the admin user and reset roles & profiles if asked to", async () => {
      request.input.args.reset = true;

      await controller.createFirstAdmin(request);

      expect(persistUser).toHaveBeenCalledOnce();
      expect(persistUser).toHaveBeenCalledWith(
        request,
        ["admin"],
        {},
        { humanReadableId: true },
      );

      expect(restrict).toHaveBeenCalledOnce();
      expect(restrict).toHaveBeenCalledWith(request);
    });
  });

  describe("#restrictDefaultRights", () => {
    const roleEvent = "core:security:role:createOrReplace";
    const profileEvent = "core:security:profile:createOrReplace";

    beforeEach(() => {
      request.input.args._id = "test";
    });

    it("should reset roles & profiles", async () => {
      await controller.restrictDefaultRights(request);

      const standard = config.security.standard;

      // The shipped defaults, so the loops below cannot be vacuous.
      expect(Object.keys(standard.roles)).not.toHaveLength(0);
      expect(Object.keys(standard.profiles)).not.toHaveLength(0);

      for (const [key, content] of Object.entries(standard.roles)) {
        expect(ask).toHaveBeenCalledWith(roleEvent, key, content, {
          refresh: "wait_for",
          userId: "4",
        });
      }

      for (const [key, content] of Object.entries(standard.profiles)) {
        expect(ask).toHaveBeenCalledWith(profileEvent, key, content, {
          refresh: "wait_for",
          userId: "4",
        });
      }
    });
  });
});
