import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EmbeddedSDK } from "../../../../lib/core/shared/sdk/embeddedSdk";
import ImpersonatedSDK from "../../../../lib/core/shared/sdk/impersonatedSdk";
import { PluginImplementationError } from "../../../../lib/kerror/errors/pluginImplementationError";
import { invalid } from "../../../helpers/invalid";
import { restoreKuzzle, stubKuzzle, stubLogger } from "../../../mocks/kuzzle";

describe("#core/shared/sdk/EmbeddedSDK", () => {
  let sdk: EmbeddedSDK;
  let logger: ReturnType<typeof stubLogger>;
  let query: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    logger = stubLogger();

    /*
     * `on` is what `FunnelProtocol`'s constructor registers the internal
     * notification listener with, and `log` is where the deprecation warning
     * goes. Nothing else of the application is on this path.
     */
    stubKuzzle({ log: logger });

    /*
     * `ImpersonatedSDK`'s constructor walks `global.app.sdk` to decide which
     * controllers it can wrap, so `as()` needs an application to exist. An
     * empty `sdk` is enough here: which controllers get wrapped is
     * `impersonatedSdk`'s own spec's question.
     */
    Reflect.defineProperty(global, "app", {
      configurable: true,
      value: { sdk: {} },
      writable: true,
    });

    sdk = new EmbeddedSDK();

    /*
     * The protocol below the SDK, stubbed at its one entry point rather than
     * by substituting the module: `query` is what `Kuzzle.query` eventually
     * calls, and what every assertion here is about is the request as it
     * arrives there.
     */
    query = vi.fn(async () => ({ result: {} }));
    sdk.protocol.query = query;
  });

  afterEach(() => {
    Reflect.deleteProperty(global, "app");
    restoreKuzzle();
  });

  describe("#as", () => {
    /*
     * The Mocha spec replaced `impersonatedSdk` with a `sinon.spy()` and
     * asserted that it had been called with the kuid — which says the
     * constructor ran, not that the result impersonates anyone. The real
     * class is 130 lines and needs nothing: the port asserts what comes back.
     */
    it("answers an SDK impersonating the user", () => {
      const impersonated = sdk.as({ _id: "gordon" });

      expect(impersonated).toBeInstanceOf(ImpersonatedSDK);
      expect((impersonated as unknown as ImpersonatedSDK).kuid).toBe("gordon");
    });

    it("carries the checkRights option through", () => {
      const impersonated = sdk.as({ _id: "gordon" }, { checkRights: true });

      expect((impersonated as unknown as ImpersonatedSDK).checkRights).toBe(
        true,
      );
    });

    /* Not covered by the Mocha spec: the default is the safe one. */
    it("does not check rights unless it is asked to", () => {
      expect(
        (sdk.as({ _id: "gordon" }) as unknown as ImpersonatedSDK).checkRights,
      ).toBe(false);
    });

    it.each([
      ["no _id", {}],
      ["an _id that is not a string", { _id: 123 }],
      ["not an object at all", "gordon"],
    ])("refuses a user with %s", (_case, user) => {
      expect(() => sdk.as(invalid(user))).toThrow(PluginImplementationError);
      expect(() => sdk.as(invalid(user))).toThrow(
        expect.objectContaining({ id: "plugin.context.invalid_user" }),
      );
    });
  });

  describe("#query", () => {
    const subscribe = { action: "subscribe", controller: "realtime" };

    it("does not propagate a realtime subscription across the cluster by default", async () => {
      await sdk.query(subscribe);

      expect(query.mock.calls[0][0]).toMatchObject({
        ...subscribe,
        propagate: false,
      });
    });

    it("propagates it when asked to", async () => {
      await sdk.query({ ...subscribe }, { propagate: true });

      expect(query.mock.calls[0][0]).toMatchObject({
        ...subscribe,
        propagate: true,
      });
    });

    /*
     * Not covered by the Mocha spec: the flag is set on `realtime:subscribe`
     * and on nothing else — a `propagate` on every request would change what
     * the other controllers do with an unknown field.
     */
    it("leaves any other request alone", async () => {
      await sdk.query({ action: "get", controller: "document" });

      expect(query.mock.calls[0][0]).not.toHaveProperty("propagate");
    });

    it("refuses an action a plugin must not call on its own behalf", () => {
      expect(() =>
        sdk.query({ action: "createApiKey", controller: "auth" }),
      ).toThrow(
        expect.objectContaining({
          id: "api.process.forbidden_embedded_sdk_action",
        }),
      );
    });

    /*
     * The Mocha spec asserted one of the fifteen. The list is the API surface
     * a plugin is not allowed to reach as itself — an entry dropped from it
     * is a privilege the embedded SDK silently gains.
     */
    it.each([
      "checkRights",
      "createApiKey",
      "createMyCredentials",
      "credentialsExist",
      "deleteApiKey",
      "getCurrentUser",
      "getMyCredentials",
      "getMyRights",
      "getStrategies",
      "logout",
      "refreshToken",
      "searchApiKeys",
      "updateMyCredentials",
      "updateSelf",
      "validateMyCredentials",
    ])("refuses auth:%s", (action) => {
      expect(() => sdk.query({ action, controller: "auth" })).toThrow(
        expect.objectContaining({
          id: "api.process.forbidden_embedded_sdk_action",
        }),
      );
    });

    it("warns on a deprecated action, and still performs it", async () => {
      await sdk.query({ action: "login", controller: "auth" });

      expect(logger.warn).toHaveBeenCalledWith(
        "EmbeddedSDK.login is deprecated, use user impersonation instead",
      );
      /*
       * The Mocha spec called `query` without awaiting it and asserted only
       * the warning — so it never said whether a warned action still runs.
       */
      expect(query).toHaveBeenCalledTimes(1);
    });

    it("says nothing about an action that is neither forbidden nor deprecated", async () => {
      await sdk.query({ action: "get", controller: "document" });

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
