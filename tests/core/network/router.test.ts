import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KuzzleRequest, RequestContext } from "../../../lib/api/request";
import { loadConfig } from "../../../lib/config";
import HttpMessage from "../../../lib/core/network/protocols/httpMessage";
import Router from "../../../lib/core/network/router";
import { PluginImplementationError } from "../../../lib/kerror/errors/pluginImplementationError";
import { settle } from "../../helpers/settle";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";
import { present } from "../../helpers/present";

/*
 * One file for one subject: Mocha had `router/router.test.js` and
 * `router/httpRequest.test.js`, both for `lib/core/network/router.ts`, and
 * under the `tests/` mirror neither can own it alone — see L1b1 in the step
 * file. The two `describe` blocks are the two former files.
 */

/**
 * The slice of uWS's `HttpRequest` that `HttpMessage` reads.
 *
 * `test/mocks/uWS.mock.js` also models the *response* side and the socket
 * lifecycle, which nothing here touches. Four Mocha specs use that mock; when
 * the next one is ported, this belongs in `tests/mocks/uWS.ts` — for one spec
 * it is clearer beside the assertions.
 */
const httpRequest = (
  method: string,
  url: string,
  query = "",
  headers: Record<string, string> = {},
) => ({
  forEach: (callback: (name: string, value: string) => void) => {
    for (const [name, value] of Object.entries(headers)) {
      callback(name, value);
    }
  },
  getHeader: (name: string) => headers[name],
  getMethod: () => method.toUpperCase(),
  getQuery: () => query,
  getUrl: () => url,
});

describe("#core/network/Router", () => {
  const connectionId = "bar";
  const protocol = "foo";

  let router: Router;
  let statistics: {
    dropConnection: ReturnType<typeof vi.fn>;
    newConnection: ReturnType<typeof vi.fn>;
  };
  let logged: ReturnType<typeof vi.spyOn>;

  const contextFor = (connection: Record<string, unknown>) =>
    new RequestContext({ connection });

  describe("connection bookkeeping", () => {
    let requestContext: RequestContext;

    beforeEach(() => {
      /*
       * The subject keeps a map of live connections and counts them on the
       * statistics module. `ask` is here for the realtime disconnect it fires
       * when a connection goes away.
       */
      statistics = { dropConnection: vi.fn(), newConnection: vi.fn() };
      /*
       * The constructor builds the HTTP router, which reads the CORS config —
       * so even the bookkeeping half needs the real config loaded.
       */
      stubKuzzle({
        ask: vi.fn(async () => undefined),
        config: loadConfig(),
        statistics,
      });

      requestContext = contextFor({ id: connectionId, protocol });
      router = new Router();
      /*
       * `Router.logger` is private, and half this block's assertions are about
       * what it was handed — an invalid connection is *logged*, not thrown.
       * Named once rather than at each use.
       */
      logged = vi.spyOn(
        (router as unknown as { logger: { error: (error: unknown) => void } })
          .logger,
        "error",
      );
    });

    afterEach(() => {
      restoreKuzzle();
    });

    describe("#newConnection", () => {
      it("registers the connection and counts it", () => {
        router.newConnection(requestContext);

        const stored = router.connections.get(connectionId);

        expect(stored).toBeInstanceOf(RequestContext);
        present(stored, `connection ${connectionId}`);
        expect(stored.connectionId).toBe(connectionId);
        expect(stored.protocol).toBe(protocol);
        expect(stored.token).toBeNull();
        expect(statistics.newConnection).toHaveBeenCalledTimes(1);
        expect(statistics.newConnection).toHaveBeenCalledWith(requestContext);
      });

      it.each(["id", "protocol"] as const)(
        "logs a plugin error when the %s is missing",
        (missing) => {
          const connection: Record<string, unknown> = {
            id: connectionId,
            protocol,
          };
          delete connection[missing];

          router.newConnection(contextFor(connection));

          expect(logged).toHaveBeenCalledTimes(1);
          expect(logged).toHaveBeenCalledWith(
            expect.any(PluginImplementationError),
          );
          /*
           * Not asserted by the Mocha spec: logging is only half of it — an
           * invalid connection must not be registered either.
           */
          expect(router.connections.size).toBe(0);
        },
      );
    });

    describe("#removeConnection", () => {
      it("drops the connection and counts it out", () => {
        router.connections.set(connectionId, requestContext);

        router.removeConnection(requestContext);

        expect(statistics.dropConnection).toHaveBeenCalledTimes(1);
        expect(statistics.dropConnection).toHaveBeenCalledWith(requestContext);
        expect(router.connections.has(connectionId)).toBe(false);
      });

      it("logs a plugin error for a connection it never registered", () => {
        router.removeConnection(requestContext);

        expect(statistics.dropConnection).not.toHaveBeenCalled();
        expect(logged).toHaveBeenCalledTimes(1);
        expect(logged).toHaveBeenCalledWith(
          expect.any(PluginImplementationError),
        );
      });

      it.each(["id", "protocol"] as const)(
        "logs a plugin error when the %s is missing",
        (missing) => {
          const connection: Record<string, unknown> = {
            id: connectionId,
            protocol,
          };
          delete connection[missing];
          const context = contextFor(connection);
          router.connections.set(connectionId, context);

          router.removeConnection(context);

          expect(logged).toHaveBeenCalledTimes(1);
          expect(logged).toHaveBeenCalledWith(
            expect.any(PluginImplementationError),
          );
        },
      );
    });

    describe("#isConnectionAlive", () => {
      it("is false for a connection it does not know", () => {
        expect(router.isConnectionAlive(requestContext)).toBe(false);
      });

      it("follows newConnection and removeConnection", () => {
        router.newConnection(requestContext);
        expect(router.isConnectionAlive(requestContext)).toBe(true);

        router.removeConnection(requestContext);
        expect(router.isConnectionAlive(requestContext)).toBe(false);
      });

      /* No id means it is not a client connection, so it cannot be dead. */
      it("is true for a connection with no id", () => {
        expect(
          router.isConnectionAlive(
            contextFor({ id: null, protocol: "foobar" }),
          ),
        ).toBe(true);
      });
    });

    describe("#metrics", () => {
      it("counts the live connections per protocol", () => {
        router.newConnection(contextFor({ id: "foo", protocol: "bar" }));
        router.newConnection(contextFor({ id: "foo2", protocol: "bar" }));

        expect(router.metrics()).toMatchObject({ connections: { bar: 2 } });
      });

      /*
       * A request context carries a nullable protocol. One without is not a
       * client connection to count, and reading `.toLowerCase()` off it threw.
       */
      it("skips a connection that carries no protocol", () => {
        router.newConnection(contextFor({ id: "foo", protocol: "bar" }));
        router.newConnection(contextFor({ id: "nada", protocol: null }));

        expect(router.metrics()).toMatchObject({ connections: { bar: 1 } });
      });
    });
  });

  describe("#http.route", () => {
    const connection = { id: "requestId" };

    let pipe: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      /*
       * These tests are about the REAL route table — "registers the routes
       * from config/httpRoutes" is the assertion — so the fixture loads the
       * real config rather than inventing routes. What is stubbed is the
       * funnel: it answers with a recognisable status so the route's own
       * plumbing is what the assertions see.
       */
      const config = loadConfig();
      // An array, as a loaded configuration holds it; the type says `string`.
      Object.assign(config.http, { accessControlAllowOrigin: ["foobar"] });
      /* Set automatically when accessControlAllowOrigin has no wildcard. */
      config.internal.allowAllOrigins = false;

      /*
       * ⚠️ `kuzzle.pipe` has TWO calling conventions and the router uses the
       * less obvious one: `pipe(event, payload, callback)`. A stub that only
       * returns a promise leaves `_executeFromHttp` waiting forever — which
       * is exactly how this showed up: seven 20-second timeouts, no error.
       * KuzzleMock honoured both, silently.
       */
      pipe = vi.fn(
        (
          _event: string,
          payload: unknown,
          callback?: (error: null, payload: unknown) => void,
        ) => {
          if (callback) {
            callback(null, payload);
            return undefined;
          }

          return Promise.resolve(payload);
        },
      );

      stubKuzzle({
        config,
        funnel: {
          execute: vi.fn(
            (
              request: KuzzleRequest,
              callback: (error: unknown, result: KuzzleRequest) => void,
            ) => {
              request.setResult({}, { status: 1234 });
              callback(null, request);
            },
          ),
          overloaded: false,
        },
        onAsk: () => {},
        pipe,
        pluginsManager: {
          routes: [
            {
              action: "bar",
              controller: "foo",
              path: "foo/bar/baz",
              verb: "get",
            },
          ],
        },
        state: "running",
        statistics: { dropConnection: vi.fn(), newConnection: vi.fn() },
      });

      router = new Router();
      router.init();
      /*
       * `httpRouter` looks a message's connection up through
       * `global.kuzzle.router.connections` — the router reaches itself through
       * the global. KuzzleMock hid that by carrying its own router instance.
       */
      global.kuzzle.router = router as never;
    });

    afterEach(() => {
      restoreKuzzle();
    });

    /** Routes one message and hands the answer back, or fails on a timeout. */
    const route = (message: HttpMessage) =>
      settle<KuzzleRequest>((resolve) => {
        router.http.route(message, resolve);
      });

    it.each([
      ["GET", "/ms/_getrange/someId", "start=start&end=end", "ms", "getrange"],
      ["post", "/my-index/my-collection/_count", "", "document", "count"],
      ["put", "/_updateSelf", "", "auth", "updateSelf"],
      ["delete", "/foobar", "", "index", "delete"],
      ["get", "/_serverInfo", "", "server", "info"],
    ] as const)(
      "routes a %s from the config route table",
      async (verb, url, query, controller, action) => {
        const message = new HttpMessage(
          connection as never,
          httpRequest(verb, url, query, { origin: "foobar" }) as never,
        );
        message.content = { foo: "bar" };

        const request = await route(message);

        expect(request.input.controller).toBe(controller);
        expect(request.input.action).toBe(action);
        expect(request.response.requestId).toBe(message.requestId);
        expect(request.response.headers["content-type"]).toBe(
          "application/json",
        );
        expect(request.response.status).toBe(1234);
        expect(pipe).toHaveBeenCalledTimes(1);
        expect(pipe.mock.calls[0][0]).toBe(`http:${verb.toLowerCase()}`);
        expect(pipe.mock.calls[0][1]).toBeInstanceOf(KuzzleRequest);
      },
    );

    it("sets the allowed origin from the config", async () => {
      const message = new HttpMessage(
        connection as never,
        httpRequest("get", "/_serverInfo", "", { origin: "foobar" }) as never,
      );

      const request = await route(message);

      expect(request.response.headers["Access-Control-Allow-Origin"]).toBe(
        "foobar",
      );
    });

    it("routes a plugin's own HTTP route", async () => {
      const message = new HttpMessage(
        connection as never,
        httpRequest("get", "/foo/bar/baz") as never,
      );

      const request = await route(message);

      expect(request.input.controller).toBe("foo");
      expect(request.input.action).toBe("bar");
      expect(request.response.status).toBe(1234);
    });

    it("answers 404 for a route that does not exist", async () => {
      const message = new HttpMessage(
        connection as never,
        httpRequest("get", "/a/b/c/d") as never,
      );

      const result = await route(message);

      expect(result.response.requestId).toBe(message.requestId);
      expect(result.response.headers["content-type"]).toBe("application/json");
      expect(result.response.status).toBe(404);
      present(result.response.error, "the response error");
      expect(result.response.error.message).toBe(
        "API URL not found: /a/b/c/d.",
      );
    });
  });
});
