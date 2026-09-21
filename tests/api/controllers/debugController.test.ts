import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DebugController } from "../../../lib/api/controllers/debugController";
import { KuzzleRequest } from "../../../lib/api/request";
import { InternalError } from "../../../lib/kerror/errors/internalError";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

describe("#api/controllers/DebugController", () => {
  let controller: DebugController;
  let ask: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    /*
     * The controller is a thin front for the `core:debugger:*` ask events, and
     * `init()` reads the one flag that decides whether the native protocol is
     * allowed at all. Those two are the whole fixture.
     */
    ask = vi.fn(async () => undefined);
    stubKuzzle({
      ask,
      config: { security: { debug: { native_debug_protocol: true } } },
      pipe: async () => undefined,
    });

    controller = new DebugController();
    await controller.init();
  });

  afterEach(() => {
    restoreKuzzle();
  });

  /** Every listener action refuses a protocol that cannot receive events. */
  const websocketRequest = () => {
    const request = new KuzzleRequest({});
    request.context.connection.protocol = "websocket";
    return request;
  };

  describe("#enable", () => {
    it("asks the debugger to connect", async () => {
      await controller.enable();

      expect(ask).toHaveBeenCalledWith("core:debugger:enable");
    });
  });

  describe("#disable", () => {
    it("asks the debugger to disconnect", async () => {
      await controller.disable();

      expect(ask).toHaveBeenCalledWith("core:debugger:disable");
    });
  });

  describe("#post", () => {
    it("forwards the method to the debugger", async () => {
      const request = new KuzzleRequest({});
      request.input.body = { method: "Debugger.enable" };

      await controller.post(request);

      expect(ask).toHaveBeenCalledWith(
        "core:debugger:post",
        "Debugger.enable",
        {},
      );
    });
  });

  /*
   * Not covered by the Mocha spec, and the reason the flag exists: every
   * action refuses when the native protocol is disabled. The Mocha spec set
   * the flag to `true` once and never tested the other branch.
   */
  it("refuses every action when the native protocol is disabled", async () => {
    global.kuzzle.config.security.debug.native_debug_protocol = false;

    for (const call of [
      () => controller.enable(),
      () => controller.disable(),
      () => controller.post(new KuzzleRequest({})),
      () => controller.addListener(websocketRequest()),
      () => controller.removeListener(websocketRequest()),
    ]) {
      await expect(call()).rejects.toMatchObject({
        id: "core.debugger.native_debug_protocol_usage_denied",
      });
    }
  });

  describe("#addListener", () => {
    it("refuses a protocol other than websocket", async () => {
      const request = websocketRequest();
      request.context.connection.protocol = "http";

      const rejection = controller.addListener(request);

      await expect(rejection).rejects.toBeInstanceOf(InternalError);
      await expect(rejection).rejects.toMatchObject({
        id: "api.assert.unsupported_protocol",
      });
    });

    it("registers the listener for the connection", async () => {
      const request = websocketRequest();
      request.input.body = { event: "EventMock.event_foo" };
      request.context.connection.id = "foobar";

      await controller.addListener(request);

      expect(ask).toHaveBeenCalledWith(
        "core:debugger:addListener",
        "EventMock.event_foo",
        "foobar",
      );
    });
  });

  describe("#removeListener", () => {
    it("refuses a protocol other than websocket", async () => {
      const request = websocketRequest();
      request.context.connection.protocol = "http";

      const rejection = controller.removeListener(request);

      await expect(rejection).rejects.toBeInstanceOf(InternalError);
      await expect(rejection).rejects.toMatchObject({
        id: "api.assert.unsupported_protocol",
      });
    });

    it("removes the listener for the connection", async () => {
      const request = websocketRequest();
      request.input.body = { event: "EventMock.event_foo" };
      request.context.connection.id = "foobar";

      await controller.removeListener(request);

      expect(ask).toHaveBeenCalledWith(
        "core:debugger:removeListener",
        "EventMock.event_foo",
        "foobar",
      );
    });
  });
});
