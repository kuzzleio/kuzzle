import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type ClientConnection from "../../../../lib/core/network/clientConnection";
import { asHttpRequest, MockHttpRequest } from "../../../mocks/uWS";
import { restoreKuzzle, stubKuzzle } from "../../../mocks/kuzzle";
import { settle } from "../../../helpers/settle";

/**
 * The whole of what `HttpMessage` reads from a connection: its id. Typed as
 * the full `ClientConnection` because that is what the constructor declares.
 */
const connection = { id: "requestId" } as unknown as ClientConnection;

/**
 * The router is re-imported per test rather than imported once: one of its
 * tests substitutes `routeHandler` for a class that throws, and `vi.mock` is
 * hoisted — a module-level mock would apply to every test in the file. See
 * _"reports an exception thrown while building the request"_ below.
 */
async function loadRouter() {
  vi.resetModules();

  // ⚠️ Every module this file needs is loaded here, before the global is
  // stubbed, and never from inside a test. Importing one later — the package
  // entrypoint, say — evaluates `lib/kuzzle/kuzzle.ts` for the first time in
  // the fresh registry, which **re-installs `global.kuzzle`'s accessor over a
  // null instance** and throws the stub away mid-test. Two tests failed that
  // way with "Kuzzle instance not found" before this was hoisted.
  const [{ default: Router }, { default: HttpMessage }, { Request }] =
    await Promise.all([
      import("../../../../lib/core/network/httpRouter"),
      import("../../../../lib/core/network/protocols/httpMessage"),
      import("../../../../lib/api/request"),
    ]);

  return { HttpMessage, Request, Router };
}

describe("core/network/httpRouter", () => {
  let router: any;
  let HttpMessage: any;
  let Request: any;
  let handler: ReturnType<typeof vi.fn>;
  let pipe: ReturnType<typeof vi.fn>;

  /**
   * The real configuration, deep-copied.
   *
   * `defaultHeaders` is assembled in the constructor out of five config
   * branches, and the whole point of three of these tests is which values land
   * in it — a hand-written config would agree with the assertion by
   * construction. `loadConfig()` answers a shared singleton, hence the copy.
   */
  const stubConfig = async () => {
    const { loadConfig } = await import("../../../../lib/config");

    // ⚠️ `kuzzle.pipe` has two calling conventions, and the router uses the
    // less obvious one: `pipe(event, request, callback)`. A promise-only stub
    // does not hang the router — it hangs the *spec*, for the full 20s
    // timeout, with no error. Third time this shape has cost a slice (L1b3).
    pipe = vi.fn(
      (
        _event: string,
        request: unknown,
        cb?: (error: Error | null, result: unknown) => void,
      ) => {
        if (cb) {
          cb(null, request);
          return;
        }

        return Promise.resolve(request);
      },
    );

    stubKuzzle({
      config: structuredClone(loadConfig()),
      pipe,
      router: { connections: new Map() },
    });
  };

  beforeEach(async () => {
    const loaded = await loadRouter();

    HttpMessage = loaded.HttpMessage;
    Request = loaded.Request;
    await stubConfig();

    router = new loaded.Router();
    handler = vi.fn((_request: unknown, cb: (result: unknown) => void) =>
      cb(_request),
    );
  });

  afterEach(() => {
    restoreKuzzle();
  });

  /** `router.route(message, callback)`, as a promise. */
  const route = (message: unknown) =>
    settle<any>((resolve) => router.route(message, resolve));

  const message = (
    method: string,
    url: string,
    qs = "",
    headers: Record<string, string> = {},
  ) =>
    new HttpMessage(
      connection,
      asHttpRequest(new MockHttpRequest(method, url, qs, headers)),
    );

  describe("#adding routes", () => {
    it.each(["get", "post", "put", "patch", "delete", "head"])(
      "adds a %s route",
      (verb) => {
        router[verb]("/foo/bar", handler);

        expect(
          router.routes[verb.toUpperCase()].subparts.foo.subparts.bar.handler,
        ).toBe(handler);
      },
    );

    it("rejects a duplicate url", () => {
      router.post("/foo/bar", handler);

      expect(() => router.post("/foo/bar", handler)).toThrow(
        expect.objectContaining({ id: "network.http.duplicate_url" }),
      );
    });

    it("rejects a duplicate url differing only by a trailing slash", () => {
      router.post("/foo/bar", handler);

      expect(() => router.post("/foo/bar/", handler)).toThrow(
        expect.objectContaining({ id: "network.http.duplicate_url" }),
      );
    });
  });

  describe("#defaultHeaders", () => {
    it("announces every compression algorithm and the CORS defaults", () => {
      expect(router.defaultHeaders).toEqual({
        "content-type": "application/json",
        "Accept-Encoding": "gzip,deflate,identity",
        "Access-Control-Allow-Methods":
          "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers":
          "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, Content-Encoding, Content-Length, X-Kuzzle-Volatile",
      });
    });

    it("announces identity only when compression is disabled", () => {
      // ⚠️ `cookieAuthentication` defaults to `true`, and the credentials
      // header follows it. The Mocha spec set it to `false` in a `beforeEach`
      // that ran *after* the suite's own `new Router()` — so the first of
      // these three tests saw the real default and the other two saw `false`,
      // by accident of ordering. Each says what it depends on here.
      global.kuzzle.config.http.cookieAuthentication = false;
      global.kuzzle.config.server.protocols.http.allowCompression = false;

      expect(new (router.constructor as any)().defaultHeaders).toEqual({
        "content-type": "application/json",
        "Accept-Encoding": "identity",
        "Access-Control-Allow-Methods":
          "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD",
        "Access-Control-Allow-Headers":
          "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, Content-Encoding, Content-Length, X-Kuzzle-Volatile",
      });
    });

    it("takes the CORS headers from the configuration when they are set", () => {
      global.kuzzle.config.http.cookieAuthentication = false;
      global.kuzzle.config.http.accessControlAllowMethods = "METHOD";
      global.kuzzle.config.http.accessControlAllowHeaders = "headers";

      expect(new (router.constructor as any)().defaultHeaders).toEqual({
        "content-type": "application/json",
        "Accept-Encoding": "gzip,deflate,identity",
        "Access-Control-Allow-Methods": "METHOD",
        "Access-Control-Allow-Headers": "headers",
      });
    });
  });

  describe("#route", () => {
    it("invokes the registered handler with a Request", async () => {
      router.post("/foo/bar", handler);

      await route(message("post", "/foo/bar"));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]).toBeInstanceOf(Request);
    });

    it("builds the request context from the connection and the headers", async () => {
      router.post("/foo/bar", handler);

      await route(
        message("post", "/foo/bar", "", {
          Authorization: "Bearer jwtFoobar",
          foo: "bar",
          "X-Kuzzle-Volatile": '{"modifiedBy": "John Doe", "reason": "foobar"}',
        }),
      );

      const request = handler.mock.calls[0][0];

      expect(request.context.connection.protocol).toBe("http");
      expect(request.context.connection.id).toBe("requestId");
      expect(request.context.connection.misc.headers).toEqual({
        foo: "bar",
        Authorization: "Bearer jwtFoobar",
        "X-Kuzzle-Volatile": '{"modifiedBy": "John Doe", "reason": "foobar"}',
      });
      expect(request.context.connection.misc.verb).toBe("POST");
      expect(request.input.jwt).toBe("jwtFoobar");
      expect(request.input.volatile).toEqual({
        modifiedBy: "John Doe",
        reason: "foobar",
      });
    });

    it.each([
      ["without a trailing slash", "/foo/bar", "foo=bar", { foo: "bar" }],
      [
        "with a trailing slash",
        "/foo/bar/",
        "foo=bar&baz=qux",
        { baz: "qux", foo: "bar" },
      ],
    ])("parses the query string %s", async (_name, url, qs, expected) => {
      router.post("/foo/bar", handler);

      await route(message("post", url, qs));

      expect(handler.mock.calls[0][0].input.args).toMatchObject(expected);
    });

    it("carries the body and the content type through", async () => {
      router.post("/foo/bar", handler);

      const httpMessage = message("post", "/foo/bar", "", {
        "content-type": "application/json",
      });
      httpMessage.content = { foo: "bar" };

      await route(httpMessage);

      const request = handler.mock.calls[0][0];

      expect(request.id).toBe(httpMessage.requestId);
      expect(request.input.body).toEqual({ foo: "bar" });
      expect(request.input.headers["content-type"]).toBe("application/json");
    });

    it.each([
      ["as they are", "/foo/hello/world", "application/json", "world"],
      [
        "url-decoded",
        "/foo/hello/%25world",
        "application/json; charset=utf-8",
        "%world",
      ],
    ])(
      "returns the dynamic values of a parametric route %s",
      async (_name, url, contentType, baz) => {
        router.post("/foo/:bar/:baz", handler);

        const httpMessage = message("post", url, "", {
          "content-type": contentType,
        });
        httpMessage.content = { foo: "bar" };

        await route(httpMessage);

        const request = handler.mock.calls[0][0];

        expect(request.id).toBe(httpMessage.requestId);
        expect(request.input.body).toEqual({ foo: "bar" });
        expect(request.input.headers["content-type"]).toBe(contentType);
        expect(request.input.args.bar).toBe("hello");
        expect(request.input.args.baz).toBe(baz);
      },
    );

    it("answers an OPTIONS request itself, and pipes http:options", async () => {
      global.kuzzle.config.internal.allowAllOrigins = false;
      global.kuzzle.config.http.accessControlAllowOrigin = ["foo"];

      const httpMessage = message("options", "/", "", {
        "content-type": "application/json",
        foo: "bar",
        origin: "foo",
      });

      const result = await route(httpMessage);

      expect(handler).not.toHaveBeenCalled();
      expect(result.response.toJSON()).toMatchObject({
        raw: false,
        status: 200,
        requestId: httpMessage.requestId,
        content: { error: null, requestId: "requestId", result: {} },
        headers: {
          ...router.defaultHeaders,
          "Access-Control-Allow-Origin": "foo",
          Vary: "Origin",
        },
      });
      expect(result.input.headers).toMatchObject(httpMessage.headers);

      expect(pipe).toHaveBeenCalledTimes(1);
      expect(pipe.mock.calls[0][0]).toBe("http:options");
      expect(pipe.mock.calls[0][1]).toBeInstanceOf(Request);
      expect(pipe.mock.calls[0][1].input.headers.foo).toBe("bar");
    });

    it("answers a HEAD request on the default / route", async () => {
      global.kuzzle.config.internal.allowAllOrigins = false;
      global.kuzzle.config.http.accessControlAllowOrigin = ["foo"];

      const httpMessage = message("head", "/", "", {
        "content-type": "application/json",
        foo: "bar",
        origin: "foo",
      });

      const result = await route(httpMessage);

      expect(handler).not.toHaveBeenCalled();
      expect(result.response.toJSON()).toMatchObject({
        raw: false,
        status: 200,
        requestId: httpMessage.requestId,
        content: { error: null, requestId: "requestId", result: {} },
        headers: {
          ...router.defaultHeaders,
          "Access-Control-Allow-Origin": "foo",
          Vary: "Origin",
        },
      });
      expect(result.input.headers).toMatchObject(httpMessage.headers);
    });

    it("rejects an unknown HTTP method", async () => {
      global.kuzzle.config.internal.allowAllOrigins = false;
      global.kuzzle.config.http.accessControlAllowOrigin = ["foo"];

      router.post("/foo/bar", handler);

      const httpMessage = message("foobar", "/foo/bar", "", {
        "content-type": "application/json",
        origin: "foo",
      });
      httpMessage.content = { foo: "bar" };

      const result = await route(httpMessage);

      expect(handler).not.toHaveBeenCalled();
      expect(result.response.toJSON()).toMatchObject({
        status: 400,
        content: {
          error: { status: 400, id: "network.http.unsupported_verb" },
        },
        headers: {
          ...router.defaultHeaders,
          "Access-Control-Allow-Origin": "foo",
          Vary: "Origin",
        },
      });
    });

    it("rejects an unparseable x-kuzzle-volatile header", async () => {
      router.get("/foo/bar", handler);

      const result = await route(
        message("get", "/foo/bar", "", {
          "content-type": "application/json",
          "x-kuzzle-volatile": "{bad JSON syntax}",
        }),
      );

      expect(handler).not.toHaveBeenCalled();
      expect(result.response.toJSON()).toMatchObject({
        status: 400,
        content: {
          error: { status: 400, id: "network.http.volatile_parse_failed" },
        },
        headers: router.defaultHeaders,
      });
    });

    it("rejects a url that matches no route", async () => {
      router.post("/foo/bar", handler);

      const httpMessage = message("put", "/foo/bar", "", {
        "content-type": "application/json",
      });
      httpMessage.content = { foo: "bar" };

      const result = await route(httpMessage);

      expect(handler).not.toHaveBeenCalled();
      expect(result.response.toJSON()).toMatchObject({
        status: 404,
        content: { error: { status: 404, id: "network.http.url_not_found" } },
        headers: router.defaultHeaders,
      });
    });

    it("reports an exception thrown while building the request", async () => {
      // The only substitution in this file, and the only one in L4 so far that
      // is genuinely per-test: `routeHandler` throws for this test and must not
      // for the others. `vi.doMock` is the non-hoisted form — it applies to
      // imports made after it, which is why the subject is re-imported here.
      vi.doMock(
        "../../../../lib/core/network/httpRouter/routeHandler",
        async () => {
          const { InternalError } =
            await import("../../../../lib/kerror/errors/internalError");

          return {
            default: class {
              get request(): never {
                throw new InternalError("HTTP internal exception.");
              }
            },
          };
        },
      );

      try {
        const { Router, HttpMessage: FreshMessage } = await loadRouter();

        await stubConfig();
        router = new Router();
        router.post("/foo/bar", handler);

        const httpMessage = new FreshMessage(
          connection,
          asHttpRequest(
            new MockHttpRequest("post", "/foo/bar", "", {
              "content-type": "application/json",
            }),
          ),
        );
        httpMessage.content = { foo: "bar" };

        const result = await route(httpMessage);

        expect(handler).not.toHaveBeenCalled();
        expect(result.response.toJSON()).toMatchObject({
          raw: false,
          status: 500,
          requestId: httpMessage.requestId,
          content: {
            error: { status: 500, message: "HTTP internal exception." },
            requestId: "requestId",
            result: null,
          },
          headers: router.defaultHeaders,
        });
      } finally {
        vi.doUnmock("../../../../lib/core/network/httpRouter/routeHandler");
      }
    });
  });

  describe("deprecated routes", () => {
    it("declares a `since` and a `message` on every deprecated route", async () => {
      // Not about the router: `lib/api/httpRoutes` is the subject, and it has
      // no spec of its own. Kept where it was found.
      const { default: httpRoutes } =
        await import("../../../../lib/api/httpRoutes");

      const deprecated = httpRoutes
        .filter((route: any) => route.deprecated)
        .map((route: any) => route.deprecated);

      expect(deprecated.length).toBeGreaterThan(0);

      for (const entry of deprecated) {
        expect(entry).toHaveProperty("since");
        expect(entry).toHaveProperty("message");
      }
    });
  });
});
