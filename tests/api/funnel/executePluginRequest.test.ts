import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NativeController } from "../../../lib/api/controllers/baseController";
import Funnel from "../../../lib/api/funnel";
import { KuzzleRequest } from "../../../lib/api/request";
import { InternalError } from "../../../lib/kerror/errors/internalError";
import { NotFoundError } from "../../../lib/kerror/errors/notFoundError";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/**
 * `test/mocks/controller.mock.js` is not ported: it is a sinon factory two
 * specs share, and half of what it provides (`MockBaseController`) is unused
 * here. The two actions this spec drives are declared inline instead, so the
 * controller under the funnel is readable in the same file as the assertions.
 */
class MockNativeController extends NativeController {
  public failResult = new InternalError("rejected action");
  public fail = vi.fn(async () => {
    throw this.failResult;
  });
  public succeed = vi.fn(async (request: KuzzleRequest) => request);

  _isAction(name: string) {
    return name === "succeed" || name === "fail";
  }
}

/** The subject dumps from a `setImmediate`, so the assertions queue behind one. */
const afterImmediate = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

describe("#api/funnel.executePluginRequest", () => {
  let funnel: Funnel;
  let controller: MockNativeController;
  let dump: ReturnType<typeof vi.fn>;
  let emit: ReturnType<typeof vi.fn>;
  let pipe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dump = vi.fn();
    emit = vi.fn();
    pipe = vi.fn(async (_event, payload) => payload);

    /*
     * Two halves of the application, and no more: the pipes `processRequest`
     * fires when `triggerEvents` is set, and the dump path `handleErrorDump`
     * takes on failure — `config.dump` plus `dump()` itself. `statistics` is
     * what `processRequest` counts through.
     */
    stubKuzzle({
      config: {
        dump: {
          enabled: false,
          handledErrors: {
            enabled: true,
            minInterval: 0,
            whitelist: ["InternalError"],
          },
        },
        /* `_checkSdkVersion` guards the head of `processRequest`. */
        server: { strictSdkVersion: false },
        limits: {
          concurrentRequests: 100,
          requestsBufferSize: 50000,
          requestsBufferWarningThreshold: 5000,
        },
      },
      dump,
      emit,
      pipe,
      /* `getController` looks the name up in the plugin map too. */
      pluginsManager: { controllers: new Map() },
      statistics: {
        completedRequest: () => {},
        failedRequest: () => {},
        startRequest: () => {},
      },
    });

    funnel = new Funnel();
    controller = new MockNativeController();
    funnel.controllers.set("testme", controller as never);
  });

  afterEach(() => {
    restoreKuzzle();
  });

  it("rejects a request for a controller it does not know", async () => {
    const request = new KuzzleRequest({ action: "bar", controller: "foo" });
    const rejection = funnel.executePluginRequest(request);

    await expect(rejection).rejects.toBeInstanceOf(NotFoundError);
    await expect(rejection).rejects.toMatchObject({
      id: "api.process.controller_not_found",
    });
    expect(emit).not.toHaveBeenCalled();
  });

  it("executes the request against its controller", async () => {
    const request = new KuzzleRequest({
      action: "succeed",
      controller: "testme",
    });

    expect(await funnel.executePluginRequest(request)).toBe(request);
    expect(controller.succeed).toHaveBeenCalledTimes(1);
    expect(controller.succeed).toHaveBeenCalledWith(request);
  });

  it("dumps on an error whose type is whitelisted", async () => {
    global.kuzzle.config.dump.enabled = true;
    const logged = vi.spyOn(funnel.logger, "error");
    const request = new KuzzleRequest({ action: "fail", controller: "testme" });

    await expect(funnel.executePluginRequest(request)).rejects.toBe(
      controller.failResult,
    );
    /*
     * The Mocha spec waited 50ms for the `setImmediate` inside
     * `handleErrorDump`. Queueing behind the same macrotask asserts the same
     * thing without a sleep that can be too short on a loaded machine.
     */
    await afterImmediate();

    expect(logged).toHaveBeenCalledTimes(1);
    expect(dump).toHaveBeenCalledTimes(1);
  });

  it("does not dump when dumping is disabled", async () => {
    global.kuzzle.config.dump.enabled = false;
    const request = new KuzzleRequest({ action: "fail", controller: "testme" });

    await expect(funnel.executePluginRequest(request)).rejects.toBe(
      controller.failResult,
    );
    await afterImmediate();

    expect(dump).not.toHaveBeenCalled();
  });

  /*
   * Not covered by the Mocha spec: `handledErrors.whitelist` is the filter the
   * dump path exists for, and nothing asserted that an error outside it is
   * left alone.
   */
  it("does not dump an error whose type is not whitelisted", async () => {
    global.kuzzle.config.dump.enabled = true;
    controller.failResult = new NotFoundError("not whitelisted") as never;
    const request = new KuzzleRequest({ action: "fail", controller: "testme" });

    await expect(funnel.executePluginRequest(request)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await afterImmediate();

    expect(dump).not.toHaveBeenCalled();
  });

  it("triggers the action's pipes when triggerEvents is set", async () => {
    const request = new KuzzleRequest({
      action: "succeed",
      controller: "testme",
      triggerEvents: true,
    });

    await funnel.executePluginRequest(request);

    const events = pipe.mock.calls.map(([event]) => event);
    expect(events).toContain("testme:beforeSucceed");
    expect(events).toContain("testme:afterSucceed");
  });

  it("triggers no pipe when triggerEvents is not set", async () => {
    const request = new KuzzleRequest({
      action: "succeed",
      controller: "testme",
    });

    await funnel.executePluginRequest(request);

    const events = pipe.mock.calls.map(([event]) => event);
    expect(events).not.toContain("testme:beforeSucceed");
    expect(events).not.toContain("testme:afterSucceed");
  });

  it("triggers the error pipe, and not the after pipe, on a failure", async () => {
    const request = new KuzzleRequest({
      action: "fail",
      controller: "testme",
      triggerEvents: true,
    });

    await expect(funnel.executePluginRequest(request)).rejects.toMatchObject({
      message: "rejected action",
    });

    const events = pipe.mock.calls.map(([event]) => event);
    expect(events).toContain("testme:beforeFail");
    expect(events).toContain("testme:errorFail");
    expect(events).not.toContain("testme:afterFail");
  });
});
