import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KuzzleRequest, Request } from "../../../lib/api/request";
import { Koncorde } from "../../../lib/core/shared/KoncordeWrapper";
import { EmbeddedSDK } from "../../../lib/core/shared/sdk/embeddedSdk";
import { PluginContext } from "../../../lib/core/plugin/pluginContext";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { ExternalServiceError } from "../../../lib/kerror/errors/externalServiceError";
import { ForbiddenError } from "../../../lib/kerror/errors/forbiddenError";
import { GatewayTimeoutError } from "../../../lib/kerror/errors/gatewayTimeoutError";
import { InternalError } from "../../../lib/kerror/errors/internalError";
import { KuzzleError } from "../../../lib/kerror/errors/kuzzleError";
import { NotFoundError } from "../../../lib/kerror/errors/notFoundError";
import { PartialError } from "../../../lib/kerror/errors/partialError";
import { PluginImplementationError } from "../../../lib/kerror/errors/pluginImplementationError";
import { PreconditionError } from "../../../lib/kerror/errors/preconditionError";
import { ServiceUnavailableError } from "../../../lib/kerror/errors/serviceUnavailableError";
import { SizeLimitError } from "../../../lib/kerror/errors/sizeLimitError";
import { TooManyRequestsError } from "../../../lib/kerror/errors/tooManyRequestsError";
import { UnauthorizedError } from "../../../lib/kerror/errors/unauthorizedError";
import { Mutex } from "../../../lib/util/mutex";
import { invalid } from "../../helpers/invalid";
import { present } from "../../helpers/present";
import { settle } from "../../helpers/settle";
import { restoreKuzzle, stubKuzzle, stubLogger } from "../../mocks/kuzzle";

/** The node the fixture's storage client is pointed at. */
const ES_NODE = "http://alivedb:9200";

const SECRETS = {
  aws: { secretKeyId: "the cake is a lie" },
  kuzzleApi: "the spoon does not exist",
};

/**
 * ⚠️ `context.constructors` holds constructors, and four of its seven entries
 * are declared as the **instances** they build: `Koncorde: Koncorde`,
 * `Request: KuzzleRequest`, `RequestContext: RequestContext`,
 * `RequestInput: RequestInput`. `Mutex`, `Repository` and `ESClient` are
 * declared correctly, so the shape is not a convention — it is a mistake in
 * four places, hidden by the `as any` each one carries at its assignment.
 *
 * The consequence is that the documented use of this public API —
 * `new (constructorOf<KuzzleRequest>(context.constructors.Request))(request, {})`, which is what every plugin
 * writes — does not type-check. Recorded as
 * [TD-76](../../../docs/adr-001/type-debt-register.md#td-76); a test-porting
 * slice leaves `lib/` alone, so the cast is named here instead.
 */
const constructorOf = <T>(declared: unknown) =>
  declared as new (...args: unknown[]) => T;

/**
 * ⚠️ `lib/util/mutex` is the one substitution this spec genuinely needs, and
 * the Mocha spec never said so.
 *
 * It registered `test/mocks/mutex.mock.js` in a bare `beforeEach` and
 * re-required the subject against it, with no comment and nothing in the block
 * that follows needing it. What needs it is `#accessors.strategies`, five
 * hundred lines further down: `curryAddStrategy` takes a real
 * `new Mutex("auth:strategies:add").lock()`, which retries against the cache
 * until it wins or times out — so against a fixture that answers nothing, all
 * four strategy tests hang for the full timeout rather than failing.
 *
 * The mock's own accessor for this — `MutexMock.__getLastMutex()` — existed
 * precisely so a spec could check the lock, and no spec ever called it. The
 * resources are recorded here, and asserted.
 */
const mutexes = vi.hoisted(() => {
  const taken: string[] = [];

  return { taken };
});

vi.mock("../../../lib/util/mutex", () => ({
  Mutex: class {
    constructor(public readonly resource: string) {}

    async lock() {
      mutexes.taken.push(this.resource);
      return true;
    }

    async unlock() {}
  },
}));

describe("#core/plugin/pluginContext", () => {
  let context: PluginContext;
  let logger: ReturnType<typeof stubLogger>;
  let ask: Mock;
  let pipe: Mock;
  let executePluginRequest: Mock;
  let registerStrategy: Mock;
  let unregisterStrategy: Mock;

  beforeEach(() => {
    mutexes.taken.length = 0;
    logger = stubLogger();
    ask = vi.fn(async () => undefined);
    pipe = vi.fn(async () => undefined);
    executePluginRequest = vi.fn(async () => undefined);
    registerStrategy = vi.fn();
    unregisterStrategy = vi.fn();

    /**
     * Everything the constructor reads, and nothing else. It is a long list
     * because `PluginContext` *is* a long list: it hands a plugin a frozen
     * view of the application, so its constructor touches the config, the
     * vault, the logger, the node id, both buses, the funnel and the plugins
     * manager before it returns.
     */
    stubKuzzle({
      ask,
      config: {
        limits: {},
        plugins: {},
        repositories: { common: { cacheTTL: 1440000 } },
        services: { storageEngine: { client: { node: ES_NODE } } },
        version: "2.56.0",
      },
      funnel: { executePluginRequest },
      id: "knode-test",
      log: logger,
      pipe,
      pluginsManager: { registerStrategy, unregisterStrategy },
      validation: { addType: vi.fn(), validate: vi.fn() },
      vault: { secrets: SECRETS },
    });

    context = new PluginContext("pluginName");
  });

  afterEach(() => {
    restoreKuzzle();
  });

  describe("#constructor", () => {
    it("is an instance of PluginContext", () => {
      expect(context).toBeInstanceOf(PluginContext);
    });

    it("exposes the constructors a plugin builds with", () => {
      expect(
        new (constructorOf<Koncorde>(context.constructors.Koncorde))(),
      ).toBeInstanceOf(Koncorde);
      expect(
        new (constructorOf<KuzzleRequest>(context.constructors.Request))(
          new Request({}),
          {},
        ),
      ).toBeInstanceOf(KuzzleRequest);
      expect(new context.constructors.Mutex("resource")).toBeInstanceOf(Mutex);

      for (const name of [
        "BaseValidationType",
        "Koncorde",
        "Mutex",
        "Repository",
        "Request",
        "RequestContext",
        "RequestInput",
      ] as const) {
        expect(context.constructors[name]).toBeTypeOf("function");
      }
    });

    it("exposes a repository over the plugin's own storage", () => {
      const repository = new context.constructors.Repository(
        "someCollection",
        null,
      );

      for (const method of [
        "create",
        "createOrReplace",
        "delete",
        "get",
        "mGet",
        "replace",
        "search",
        "update",
      ] as const) {
        expect(repository[method]).toBeTypeOf("function");
      }
    });

    it("exposes the vault's secrets", () => {
      expect(context.secrets).toEqual(SECRETS);
    });

    describe("#ESClient", () => {
      it("builds a client connected to the configured cluster", () => {
        const storageClient = new context.constructors.ESClient();

        expect(storageClient).toHaveProperty("name");
        expect(storageClient).toHaveProperty("connectionPool");
        expect(storageClient.connectionPool.connections[0].url.origin).toEqual(
          ES_NODE,
        );
      });
    });

    describe("#Request", () => {
      it("throws when given no data at all", () => {
        expect(
          () =>
            new (constructorOf<KuzzleRequest>(context.constructors.Request))(),
        ).toThrow(
          expect.objectContaining({
            constructor: PluginImplementationError,
            id: "plugin.context.missing_request_data",
          }),
        );
      });

      it("copies the original request's information", () => {
        const request = new Request(
          {
            _id: "_id",
            action: "action",
            collection: "collection",
            controller: "controller",
            error: new Error("error"),
            foobar: "foobar",
            index: "index",
            jwt: "jwt",
            result: "result",
            status: 666,
            volatile: { foo: "bar" },
          },
          { connectionId: "connectionId", protocol: "protocol" },
        );

        const pluginRequest = new (constructorOf<KuzzleRequest>(
          context.constructors.Request,
        ))(request, {});

        expect(pluginRequest.context.protocol).toEqual("protocol");
        expect(pluginRequest.context.connectionId).toEqual("connectionId");
        // a fresh request, not a copy of an answered one
        expect(pluginRequest.result).toBeNull();
        expect(pluginRequest.error).toBeNull();
        expect(pluginRequest.status).toEqual(102);
        expect(pluginRequest.input.action).toBeNull();
        expect(pluginRequest.input.controller).toBeNull();
        expect(pluginRequest.input.jwt).toEqual("jwt");
        expect(pluginRequest.input.args).toMatchObject({
          _id: "_id",
          collection: "collection",
          foobar: "foobar",
          index: "index",
        });
        expect(pluginRequest.input.volatile).toMatchObject({ foo: "bar" });
      });

      it("lets the provided data override the original's", () => {
        const request = new Request(
          {
            _id: "_id",
            action: "action",
            bar: "bar",
            collection: "collection",
            controller: "controller",
            error: new Error("error"),
            foo: "foo",
            index: "index",
            jwt: "jwt",
            result: "result",
            status: 666,
            volatile: { foo: "bar" },
          },
          { connectionId: "connectionId", protocol: "protocol" },
        );

        const pluginRequest = new (constructorOf<KuzzleRequest>(
          context.constructors.Request,
        ))(request, {
          action: "pluginAction",
          collection: "pluginCollection",
          controller: "pluginController",
          foo: false,
          from: 0,
          jwt: null,
          size: 99,
          volatile: { bar: "baz", foo: "overridden" },
        });

        expect(pluginRequest.context.protocol).toEqual("protocol");
        expect(pluginRequest.context.connectionId).toEqual("connectionId");
        expect(pluginRequest.result).toBeNull();
        expect(pluginRequest.error).toBeNull();
        expect(pluginRequest.status).toEqual(102);
        expect(pluginRequest.input.action).toEqual("pluginAction");
        expect(pluginRequest.input.controller).toEqual("pluginController");
        expect(pluginRequest.input.jwt).toBeNull();
        expect(pluginRequest.input.args).toMatchObject({
          _id: "_id",
          bar: "bar",
          collection: "pluginCollection",
          foo: false,
          from: 0,
          index: "index",
          size: 99,
        });
        expect(pluginRequest.input.volatile).toMatchObject({
          bar: "baz",
          foo: "overridden",
        });
      });

      it("builds a request without an original one", () => {
        const request = new (constructorOf<KuzzleRequest>(
          context.constructors.Request,
        ))({
          action: "bar",
          controller: "foo",
        });

        expect(request).toBeInstanceOf(KuzzleRequest);
        expect(request.input.action).toEqual("bar");
        expect(request.input.controller).toEqual("foo");
      });
    });

    it.each([
      ["BadRequestError", BadRequestError],
      ["ExternalServiceError", ExternalServiceError],
      ["ForbiddenError", ForbiddenError],
      ["GatewayTimeoutError", GatewayTimeoutError],
      ["InternalError", InternalError],
      ["KuzzleError", KuzzleError],
      ["NotFoundError", NotFoundError],
      ["PartialError", PartialError],
      ["PluginImplementationError", PluginImplementationError],
      ["PreconditionError", PreconditionError],
      ["ServiceUnavailableError", ServiceUnavailableError],
      ["SizeLimitError", SizeLimitError],
      ["TooManyRequestsError", TooManyRequestsError],
      ["UnauthorizedError", UnauthorizedError],
    ] as const)("exposes %s as a constructor", (name, constructor) => {
      expect(context.errors[name]).toBeTypeOf("function");
      expect(new context.errors[name]("foo")).toBeInstanceOf(constructor);
    });

    /**
     * `context.log` is the deprecated surface and `context.logger` the
     * `kuzzle-logger` behind it, so the pairing is the contract: `silly` and
     * `verbose` both land on `trace`, and every message is prefixed with the
     * plugin's name.
     *
     * One test per level rather than the Mocha loop's five in one: its
     * `calledOnce` held only because each level happened to reach a different
     * logger method, which stops being true the moment `silly` is included —
     * which is why it was the one level left untested.
     */
    it.each([
      ["debug", "debug"],
      ["error", "error"],
      ["info", "info"],
      ["silly", "trace"],
      ["verbose", "trace"],
      ["warn", "warn"],
    ] as const)("logs %s through the logger's %s", (level, method) => {
      context.log[level]("test");

      expect(logger[method]).toHaveBeenCalledExactlyOnceWith(
        "[pluginName] test",
      );
    });

    it("exposes the accessors a plugin reaches the application through", () => {
      expect(Object.keys(context.accessors).sort()).toEqual([
        "cluster",
        "execute",
        "nodeId",
        "sdk",
        "storage",
        "strategies",
        "subscription",
        "trigger",
        "validation",
      ]);
    });

    it("exposes a data validation accessor", () => {
      expect(context.accessors.validation.addType).toBeTypeOf("function");
      expect(context.accessors.validation.validate).toBeTypeOf("function");
    });

    it("exposes a private storage accessor", () => {
      expect(context.accessors.storage.bootstrap).toBeTypeOf("function");
      expect(context.accessors.storage.createCollection).toBeTypeOf("function");
    });

    it("exposes an EmbeddedSDK", () => {
      expect(context.accessors.sdk).toBeInstanceOf(EmbeddedSDK);
    });

    it("exposes this node's id", () => {
      expect(context.accessors.nodeId).toBe(global.nodeId);
    });
  });

  describe("#accessors.subscription", () => {
    it("registers a subscription as a realtime request", async () => {
      await context.accessors.subscription.register(
        "superid",
        "nyc-open-data",
        "yellow-taxi",
        { equals: { name: "Luca" } },
      );

      expect(ask).toHaveBeenCalledOnce();

      const [event, request] = ask.mock.calls[0] as [string, KuzzleRequest];

      expect(event).toEqual("core:realtime:subscribe");
      expect(request.context.connection.id).toEqual("superid");
      expect(request.input.controller).toEqual("realtime");
      expect(request.input.action).toEqual("subscribe");
      /**
       * ⚠️ `index` and `collection` live on `input.args`, not on `input` —
       * `RequestInput` has no such getters. The Mocha assertion read them off
       * `input` on **both** sides: it built its expectation with
       * `index: customRequest.input.index`, which is `undefined`, and compared
       * it to the subject's `input.index`, also `undefined`. Two of its three
       * `input` assertions were `undefined === undefined`, and a subject that
       * dropped the index entirely passed them.
       */
      expect(request.input.args).toMatchObject({
        collection: "yellow-taxi",
        index: "nyc-open-data",
      });
      expect(request.input.body).toEqual({ equals: { name: "Luca" } });
    });

    it("unregisters by connection and room", async () => {
      await context.accessors.subscription.unregister(
        "connectionId",
        "roomId",
        false,
      );

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:unsubscribe",
        "connectionId",
        "roomId",
        false,
      );
    });
  });

  describe("#accessors.trigger", () => {
    it("pipes the event under the plugin's namespace and answers the chain", async () => {
      pipe.mockResolvedValue("pipe chain result");

      const payload = { question: "whose motorcycle is this?" };

      await expect(
        context.accessors.trigger("backHome", payload),
      ).resolves.toEqual("pipe chain result");

      expect(pipe).toHaveBeenCalledWith("plugin-pluginName:backHome", payload);
    });
  });

  describe("#accessors.execute", () => {
    const requestWith = (data: object) =>
      new Request(data, { connectionId: "connectionid" });

    it("answers the result through a callback, and not a promise", () => {
      const request = requestWith({ requestId: "request" });
      const result = { foo: "bar" };

      executePluginRequest.mockResolvedValue(result);

      return settle<void>((resolve, reject) => {
        // `execute` declares its callback as `unknown` — it validates it at
        // runtime with `isPrombackCallback` — so a callback written inline
        // gets no contextual type and has to state its own.
        const returned = context.accessors.execute(
          request,
          (error: unknown, answer?: KuzzleRequest) => {
            try {
              expect(error).toBeNull();
              expect(answer).toMatchObject(request);
              present(answer, "the answered request");
              expect(answer.result).toBe(result);
              expect(executePluginRequest).toHaveBeenCalledWith(request);
              resolve();
            } catch (assertion) {
              reject(assertion);
            }
          },
        );

        expect(returned).toBeNull();
      });
    });

    it("answers the result through a promise when given no callback", async () => {
      const request = requestWith({ requestId: "request" });
      const result = { foo: "bar" };

      executePluginRequest.mockResolvedValue(result);

      const answer = await context.accessors.execute(request);

      expect(answer).toMatchObject(request);
      present(answer, "the answered request");
      expect(answer.result).toBe(result);
      expect(executePluginRequest).toHaveBeenCalledWith(request);
    });

    it("hands the callback the error when the funnel rejects", () => {
      const request = requestWith({ body: { some: "request" } });
      const error = new Error("error");

      executePluginRequest.mockRejectedValue(error);

      return settle<void>((resolve, reject) => {
        context.accessors.execute(
          request,
          (thrown: unknown, answer?: KuzzleRequest) => {
            try {
              expect(executePluginRequest).toHaveBeenCalledWith(request);
              expect(thrown).toMatchObject(error);
              expect(answer).toBeUndefined();
              resolve();
            } catch (assertion) {
              reject(assertion);
            }
          },
        );
      });
    });

    it("rejects the promise when the funnel rejects", async () => {
      const request = requestWith({ body: { some: "request" } });
      const error = new Error("error");

      executePluginRequest.mockRejectedValue(error);

      await expect(context.accessors.execute(request)).rejects.toThrow("error");
      expect(executePluginRequest).toHaveBeenCalledWith(request);
    });

    it("hands the callback an error when given no request", () =>
      settle<void>((resolve, reject) => {
        context.accessors.execute(
          invalid<KuzzleRequest>({}),
          (error: unknown, answer?: KuzzleRequest) => {
            try {
              expect(executePluginRequest).not.toHaveBeenCalled();
              expect(error).toBeInstanceOf(PluginImplementationError);
              // Narrowed by the assertion above, not by a cast: the error is
              // `unknown` until something says what it is.
              if (!(error instanceof Error)) {
                throw new TypeError("the callback's error is not an Error");
              }

              expect(error.message).toMatch(
                /^Invalid argument: a Request object must be supplied/,
              );
              expect(answer).toBeUndefined();
              resolve();
            } catch (assertion) {
              reject(assertion);
            }
          },
        );
      }));

    it("rejects when given no request", async () => {
      await expect(
        context.accessors.execute(invalid<KuzzleRequest>({})),
      ).rejects.toThrow(/Invalid argument: a Request object must be supplied/);
    });

    it("rejects when the callback is not a function", async () => {
      await expect(
        context.accessors.execute(
          invalid<KuzzleRequest>({ requestId: "request" }),
          "foo",
        ),
      ).rejects.toThrow(
        /^Invalid argument: Expected callback to be a function, received "string"/,
      );
    });

    it.each(["subscribe", "unsubscribe"])(
      "refuses realtime:%s, which a plugin cannot execute",
      async (action) => {
        await expect(
          context.accessors.execute(
            new Request({ action, controller: "realtime" }),
          ),
        ).rejects.toThrow(
          expect.objectContaining({
            constructor: PluginImplementationError,
            id: "plugin.context.unavailable_realtime",
          }),
        );
      },
    );
  });

  describe("#accessors.strategies", () => {
    const strategy = { config: { authenticator: "foo" } };

    it("adds a strategy and names its owner", async () => {
      await context.accessors.strategies.add("foo", strategy);

      expect(registerStrategy).toHaveBeenCalledWith(
        "pluginName",
        "foo",
        strategy,
      );
      expect(pipe).toHaveBeenCalledWith("core:auth:strategyAdded", {
        name: "foo",
        pluginName: "pluginName",
        strategy,
      });
      expect(mutexes.taken).toEqual(["auth:strategies:add"]);
    });

    it("rejects when the registration throws", async () => {
      registerStrategy.mockImplementation(() => {
        throw new Error("foobar");
      });

      await expect(
        context.accessors.strategies.add("foo", strategy),
      ).rejects.toThrow("foobar");
    });

    it("refuses a strategy that names no authenticator", async () => {
      await expect(
        context.accessors.strategies.add("foo", invalid<never>(null)),
      ).rejects.toThrow(
        expect.objectContaining({
          constructor: PluginImplementationError,
          message:
            '[pluginName] Strategy foo: dynamic strategy registration can only be done using an "authenticator" option (see https://tinyurl.com/y7boozbk).\nThis is probably not a Kuzzle error, but a problem with a plugin implementation.',
        }),
      );
    });

    it("removes a strategy", async () => {
      await context.accessors.strategies.remove("foo");

      expect(unregisterStrategy).toHaveBeenCalledWith("pluginName", "foo");
      expect(pipe).toHaveBeenCalledWith("core:auth:strategyRemoved", {
        name: "foo",
        pluginName: "pluginName",
      });
      expect(mutexes.taken).toEqual(["auth:strategies:remove"]);
    });

    it("rejects when the removal throws", async () => {
      unregisterStrategy.mockImplementation(() => {
        throw new Error("foobar");
      });

      await expect(context.accessors.strategies.remove("foo")).rejects.toThrow(
        "foobar",
      );
    });
  });
});
