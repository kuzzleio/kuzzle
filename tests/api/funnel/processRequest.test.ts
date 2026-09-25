import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BaseController,
  NativeController,
} from "../../../lib/api/controllers/baseController";
import Funnel from "../../../lib/api/funnel";
import { KuzzleRequest } from "../../../lib/api/request";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { InternalError as KuzzleInternalError } from "../../../lib/kerror/errors/internalError";
import { NotFoundError } from "../../../lib/kerror/errors/notFoundError";
import { PluginImplementationError } from "../../../lib/kerror/errors/pluginImplementationError";
import KuzzleEventEmitter from "../../../lib/kuzzle/event/KuzzleEventEmitter";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/** The two actions every controller fixture below exposes. */
const ACTIONS = ["succeed", "fail"];

/**
 * What both controller fixtures do with a request.
 *
 * `succeed` answers the request it was handed, which is what makes
 * `processRequest`'s return value assertable; `fail` rejects with a
 * `KuzzleError`, so a spec can tell the "left alone" path from the "wrapped"
 * one by replacing the rejection.
 */
function actions() {
  return {
    fail: vi.fn(async () => {
      throw new KuzzleInternalError("rejected action");
    }),
    succeed: vi.fn(async (request: KuzzleRequest) => request as unknown),
  };
}

class StubNativeController extends NativeController {
  public readonly fail;
  public readonly succeed;

  constructor() {
    super(ACTIONS);

    const stubs = actions();

    this.fail = stubs.fail;
    this.succeed = stubs.succeed;
  }
}

class StubPluginController extends BaseController {
  public readonly fail;
  public readonly succeed;

  constructor() {
    super();

    this.__actions = new Set(ACTIONS);

    const stubs = actions();

    this.fail = stubs.fail;
    this.succeed = stubs.succeed;
  }
}

describe("#api/funnel.processRequest", () => {
  const PLUGIN_CONTROLLER = "fakePlugin/controller";

  let funnel: Funnel;
  let native: StubNativeController;
  let pluginController: StubPluginController;
  let pluginControllers: Map<string, BaseController>;
  let emitter: KuzzleEventEmitter;
  let pipe: ReturnType<typeof vi.fn>;
  let statistics: {
    completedRequest: ReturnType<typeof vi.fn>;
    failedRequest: ReturnType<typeof vi.fn>;
    startRequest: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    /*
     * `pipe` is the real emitter, wrapped in a spy rather than replaced by
     * one. Every test here asserts on which events were triggered, which a
     * spy answers; one of them — the document alias — needs registered plugin
     * pipes to actually run, and the Mocha spec got that by calling
     * `kuzzle.pipe.restore()` mid-test to reach the emitter KuzzleMock had
     * stubbed over. With no pipe registered the emitter hands the payload
     * straight back, so the two needs are the same fixture.
     */
    emitter = new KuzzleEventEmitter(10, 50);
    pipe = vi.fn((event: string, ...payload: unknown[]) =>
      emitter.pipe(event, ...payload),
    );

    statistics = {
      completedRequest: vi.fn(),
      failedRequest: vi.fn(),
      startRequest: vi.fn(),
    };

    pluginControllers = new Map();

    stubKuzzle({
      config: {
        limits: {},
        plugins: {},
        server: { strictSdkVersion: false },
        services: { storageEngine: { client: {} } },
        version: "2.56.0",
      },
      pipe,
      pluginsManager: { controllers: pluginControllers },
      registerPluginPipe: (event: string, handler: never) =>
        emitter.registerPluginPipe(event, handler),
      statistics,
    });

    funnel = new Funnel();

    native = new StubNativeController();
    pluginController = new StubPluginController();

    funnel.controllers.set("fakeController", native);
    pluginControllers.set(PLUGIN_CONTROLLER, pluginController);
  });

  afterEach(() => {
    restoreKuzzle();
  });

  /** The events `pipe` was triggered with, in order. */
  const triggered = () => pipe.mock.calls.map(([event]) => event);

  it("rejects a request naming no controller", async () => {
    const request = new KuzzleRequest({ action: "create" });

    await expect(funnel.processRequest(request)).rejects.toMatchObject({
      id: "api.process.controller_not_found",
    });
    await expect(funnel.processRequest(request)).rejects.toBeInstanceOf(
      NotFoundError,
    );

    /*
     * `getController` throws before the counter is started, so none of the
     * request lifecycle happened at all — which is what the three negative
     * assertions the Mocha spec made add up to.
     */
    expect(triggered()).toEqual([]);
    expect(statistics.startRequest).not.toHaveBeenCalled();
  });

  it("rejects a request naming no action", async () => {
    const request = new KuzzleRequest({ controller: "fakeController" });

    await expect(funnel.processRequest(request)).rejects.toMatchObject({
      id: "api.process.action_not_found",
    });
    expect(triggered()).toEqual([]);
    expect(statistics.startRequest).not.toHaveBeenCalled();
  });

  it("rejects an action the native controller does not expose", async () => {
    const request = new KuzzleRequest({
      action: "create",
      controller: "fakeController",
    });

    await expect(funnel.processRequest(request)).rejects.toMatchObject({
      id: "api.process.action_not_found",
    });
    expect(triggered()).toEqual([]);
    expect(statistics.startRequest).not.toHaveBeenCalled();
  });

  it("rejects an action the plugin controller does not expose", async () => {
    const request = new KuzzleRequest({
      action: "create",
      controller: PLUGIN_CONTROLLER,
    });

    await expect(funnel.processRequest(request)).rejects.toMatchObject({
      id: "api.process.action_not_found",
    });
    expect(triggered()).toEqual([]);
    expect(statistics.startRequest).not.toHaveBeenCalled();
  });

  it("rejects a plugin action that answers something other than a promise", async () => {
    const request = new KuzzleRequest({
      action: "succeed",
      controller: PLUGIN_CONTROLLER,
    });

    pluginController.succeed.mockReturnValue("foobar" as never);

    await expect(funnel.processRequest(request)).rejects.toMatchObject({
      id: "plugin.controller.invalid_action_response",
    });
    await expect(funnel.processRequest(request)).rejects.toBeInstanceOf(
      PluginImplementationError,
    );

    expect(triggered()).toContain(`${PLUGIN_CONTROLLER}:errorSucceed`);
    expect(triggered()).toContain("request:onError");
    expect(triggered()).not.toContain("request:onSuccess");
    expect(statistics.startRequest).toHaveBeenCalled();
  });

  it("wraps an error raised by _checkSdkVersion", async () => {
    const request = new KuzzleRequest({
      action: "succeed",
      controller: "fakeController",
    });

    /*
     * `_checkSdkVersion` is synchronous and throws: it is no longer awaited
     * (TD-26), so the stub has to throw rather than answer a rejected promise.
     *
     * It is funnel code, not controller code: its error goes through
     * `_wrapError` like a pipe's (TD-27, #2703). In production it throws a
     * KuzzleError and is left alone; only this stub's raw Error is wrapped.
     */
    funnel._checkSdkVersion = vi.fn(() => {
      throw new Error("incompatible sdk");
    });

    await expect(funnel.processRequest(request)).rejects.toMatchObject({
      message:
        "Caught an unexpected plugin error: incompatible sdk\nThis is probably not a Kuzzle error, but a problem with a plugin implementation.",
    });
  });

  /*
   * TD-27 (#2703): an error thrown by a controller action is normalized where
   * it is raised, so a native controller's bug is reported as a Kuzzle error
   * and a plugin controller's as a plugin error — and both keep an id.
   */
  it("reports a native controller's non-KuzzleError as a core error", async () => {
    const request = new KuzzleRequest({
      action: "fail",
      controller: "fakeController",
    });

    native.fail.mockRejectedValue(
      new TypeError("cannot read properties of undefined") as never,
    );

    const rejection = funnel.processRequest(request);

    await expect(rejection).rejects.toBeInstanceOf(KuzzleInternalError);
    await expect(rejection).rejects.toMatchObject({
      id: "core.fatal.unexpected_error",
      status: 500,
    });
  });

  it("reports a plugin controller's non-KuzzleError as a plugin error", async () => {
    const request = new KuzzleRequest({
      action: "fail",
      controller: PLUGIN_CONTROLLER,
    });

    pluginController.fail.mockRejectedValue(
      new TypeError("cannot read properties of undefined") as never,
    );

    const rejection = funnel.processRequest(request);

    await expect(rejection).rejects.toBeInstanceOf(PluginImplementationError);
    await expect(rejection).rejects.toMatchObject({
      id: "plugin.runtime.unexpected_error",
    });
  });

  it("leaves a controller's KuzzleError untouched", async () => {
    const request = new KuzzleRequest({
      action: "fail",
      controller: "fakeController",
    });

    const rejection = funnel.processRequest(request);

    await expect(rejection).rejects.toBeInstanceOf(KuzzleInternalError);
    await expect(rejection).rejects.toMatchObject({
      message: "rejected action",
    });
  });

  it("rejects a plugin response that cannot be serialized", async () => {
    const request = new KuzzleRequest({
      action: "succeed",
      controller: PLUGIN_CONTROLLER,
    });
    const unserializable: Record<string, unknown> = {};
    unserializable.self = unserializable;

    pluginController.succeed.mockResolvedValue(unserializable);

    const rejection = funnel.processRequest(request);

    await expect(rejection).rejects.toBeInstanceOf(PluginImplementationError);
    await expect(rejection).rejects.toMatchObject({
      id: "plugin.controller.unserializable_response",
    });
  });

  it("answers the request, and the whole success lifecycle, when nothing fails", async () => {
    const request = new KuzzleRequest({
      action: "succeed",
      controller: "fakeController",
    });

    expect(await funnel.processRequest(request)).toBe(request);

    /*
     * The Mocha spec asserted these one `calledWith` at a time, which says
     * nothing about their order — and the order is the contract: a plugin
     * pipe registered on `beforeSucceed` runs before the action, one on
     * `afterSucceed` after it.
     */
    expect(triggered()).toEqual([
      "request:onExecution",
      "fakeController:beforeSucceed",
      "fakeController:afterSucceed",
      "request:onSuccess",
    ]);
    expect(statistics.startRequest).toHaveBeenCalledTimes(1);
    expect(statistics.completedRequest).toHaveBeenCalledTimes(1);
    expect(statistics.failedRequest).not.toHaveBeenCalled();
  });

  it("stops at the action, and counts a failure, when a native action rejects", async () => {
    const request = new KuzzleRequest({
      action: "fail",
      controller: "fakeController",
    });

    await expect(funnel.processRequest(request)).rejects.toMatchObject({
      message: "rejected action",
    });

    expect(triggered()).toEqual([
      "request:onExecution",
      "fakeController:beforeFail",
      "fakeController:errorFail",
      "request:onError",
    ]);
    expect(statistics.startRequest).toHaveBeenCalledTimes(1);
    expect(statistics.completedRequest).not.toHaveBeenCalled();
    expect(statistics.failedRequest).toHaveBeenCalledTimes(1);
  });

  it("wraps a plain Error raised by a plugin action", async () => {
    const request = new KuzzleRequest({
      action: "fail",
      controller: PLUGIN_CONTROLLER,
    });

    pluginController.fail.mockRejectedValue(new Error("foobar") as never);

    await expect(funnel.processRequest(request)).rejects.toMatchObject({
      id: "plugin.runtime.unexpected_error",
      message: expect.stringContaining(
        "Caught an unexpected plugin error: foobar",
      ),
    });

    expect(triggered()).toEqual([
      "request:onExecution",
      `${PLUGIN_CONTROLLER}:beforeFail`,
      `${PLUGIN_CONTROLLER}:errorFail`,
      "request:onError",
    ]);
    expect(statistics.startRequest).toHaveBeenCalledTimes(1);
    expect(statistics.completedRequest).not.toHaveBeenCalled();
    expect(statistics.failedRequest).toHaveBeenCalledTimes(1);
  });

  /**
   * A plugin action rejecting with something that is not an Error: the client
   * gets the value's own `message`, as in v2.56.0, and never the value itself,
   * whose other properties are none of the client's business.
   */
  it.each([
    [
      "an object with a message",
      { message: "foobar", secret: "s3cr3t" },
      "foobar",
    ],
    ["a string", "foobar", "undefined"],
    ["null", null, "undefined"],
  ])(
    "wraps %s raised by a plugin action with its message only",
    async (_name, thrown, placeholder) => {
      const request = new KuzzleRequest({
        action: "fail",
        controller: PLUGIN_CONTROLLER,
      });

      pluginController.fail.mockRejectedValue(thrown as never);

      const error = await funnel.processRequest(request).then(
        () => expect.unreachable("the request should have failed"),
        (e: unknown) => e,
      );

      expect(error).toMatchObject({
        id: "plugin.runtime.unexpected_error",
        message: expect.stringMatching(
          new RegExp(`^Caught an unexpected plugin error: ${placeholder}\\n`),
        ),
      });
      expect(JSON.stringify(error)).not.toContain("s3cr3t");
    },
  );

  it("feeds a document written by the generic alias pipe back into the action", async () => {
    /*
     * What this test is about is the round trip: `performDocumentAlias`
     * extracts the documents, hands them to `generic:document:beforeWrite`,
     * and writes whatever comes back into the request — so the `_id` invented
     * by a plugin pipe is the one the controller then acts on.
     *
     * The Mocha spec drove that through the real `DocumentController` and a
     * stubbed `core:storage:public:document:create`, and made its assertions
     * *inside* the two pipes: a pipe that never ran asserted nothing, and the
     * test still passed. It also registered its plugin through
     * `pluginsManager._plugins.set(plugin)` — one argument, so the plugin was
     * stored as its own key under the value `undefined` — which was wired to
     * nothing either way, since `_initPipes` reads the argument it is handed.
     */
    const seen: Record<string, unknown> = {};

    /*
     * Registered straight on the emitter, in callback form: that is what the
     * runner calls a pipe with. The promise form the Mocha spec wrote is the
     * one `PluginsManager.registerPipe` adapts — going through the manager
     * here would be testing the manager, which has its own spec.
     */
    emitter.registerPluginPipe(
      "generic:document:beforeWrite",
      (...args: unknown[]) => {
        /*
         * `performDocumentAlias` triggers the event with the extracted
         * documents *and* the request they came from, so the callback is the
         * last argument rather than the second.
         */
        const documents = args[0] as { _id?: string }[];
        const callback = args[args.length - 1] as (
          error: unknown,
          documents: unknown,
        ) => void;

        seen.extractedId = documents[0]._id;
        documents[0]._id = "foobar";

        callback(null, documents);
      },
    );

    const document = new StubPluginController();
    funnel.controllers.set("document", document as never);
    Reflect.set(document, "create", async (request: KuzzleRequest) => {
      seen.actionId = request.input.args._id;

      return request;
    });
    Reflect.set(document, "__actions", new Set(["create"]));

    const request = new KuzzleRequest({
      action: "create",
      body: { foo: "bar" },
      collection: "bar",
      controller: "document",
      index: "foo",
    });

    await funnel.processRequest(request);

    expect(seen.extractedId).toBeUndefined();
    expect(seen.actionId).toBe("foobar");
  });

  describe("#_checkSdkVersion", () => {
    /**
     * A request carrying nothing but the volatile data the check reads.
     *
     * The Mocha spec passed an object literal `{ input: { volatile: {} } }`,
     * which the signature refuses — and a real request is what the caller
     * hands it anyway.
     */
    const requestWith = (volatile: Record<string, unknown>) =>
      new KuzzleRequest({
        action: "succeed",
        controller: "fakeController",
        volatile,
      });

    beforeEach(() => {
      global.kuzzle.config.server.strictSdkVersion = true;
    });

    it('accepts anything when "config.server.strictSdkVersion" is false', () => {
      global.kuzzle.config.server.strictSdkVersion = false;
      funnel.sdkCompatibility = { js: { min: 8 } };

      expect(() =>
        funnel._checkSdkVersion(requestWith({ sdkName: "js@7.4.2" })),
      ).not.toThrow();
    });

    /*
     * ⚠️ Three of these cases were asserted as
     * `should(funnel._checkSdkVersion(request)).not.throw()` — the subject
     * called *outside* the assertion, and `.not.throw()` then applied to its
     * return value, `undefined`. A throw would have failed the test by
     * escaping it rather than by being caught, so the cases that did not
     * throw proved nothing, and the assertion itself was dead.
     */
    it.each([
      ["a non-string sdkName", { sdkName: {} }],
      ["an empty sdkName", { sdkName: "" }],
      ["a separator that is not @", { sdkName: "js#7.4.3" }],
      ["no version", { sdkName: "js@" }],
      ["no name", { sdkName: "@7.4.3" }],
    ])("accepts %s", (_case, volatile) => {
      expect(() =>
        funnel._checkSdkVersion(requestWith(volatile)),
      ).not.toThrow();
    });

    it("accepts an SDK it knows no requirement for", () => {
      funnel.sdkCompatibility = { js: { min: 7 } };

      expect(() =>
        funnel._checkSdkVersion(requestWith({ sdkName: "csharp@8.4.2" })),
      ).not.toThrow();
    });

    it("accepts a version that satisfies the requirement", () => {
      funnel.sdkCompatibility = { js: { min: 6 } };

      expect(() =>
        funnel._checkSdkVersion(requestWith({ sdkName: "js@6.4.2" })),
      ).not.toThrow();
    });

    it("rejects a version below the requirement", () => {
      funnel.sdkCompatibility = { js: { min: 8 } };

      expect(() =>
        funnel._checkSdkVersion(requestWith({ sdkName: "js@7.4.2" })),
      ).toThrow(
        expect.objectContaining({
          id: "api.process.incompatible_sdk_version",
        }),
      );
      expect(() =>
        funnel._checkSdkVersion(requestWith({ sdkName: "js@7.4.2" })),
      ).toThrow(BadRequestError);
    });

    it("rejects the sdkVersion property v1 SDKs carried", () => {
      expect(() =>
        funnel._checkSdkVersion(requestWith({ sdkVersion: "7.4.2" })),
      ).toThrow(
        expect.objectContaining({
          id: "api.process.incompatible_sdk_version",
        }),
      );
    });
  });
});
