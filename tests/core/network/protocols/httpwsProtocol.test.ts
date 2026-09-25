import zlib from "node:zlib";
import { PassThrough } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { asEntryPoint, stubEntryPoint } from "../../../mocks/entryPoint";
import type { EntryPointStub } from "../../../mocks/entryPoint";
import { restoreKuzzle, stubKuzzle } from "../../../mocks/kuzzle";
import type { MockApp } from "../../../mocks/uWS";
import {
  asHttpRequest,
  MockHttpRequest,
  MockHttpResponse,
} from "../../../mocks/uWS";

/**
 * `test/core/network/protocols/http.test.js` and `websocket.test.js` were two
 * files over one subject: both re-required `httpwsProtocol` and both built the
 * same `HttpWs`. The `tests/` mirror maps one spec to one `lib/` file, so they
 * are one file here — the HTTP half and the WebSocket half of the same
 * protocol. (The coverage-attribution half of that argument expired with step
 * 13's L7b: one runner, one report, nothing to attribute. One subject, one
 * spec still holds.)
 */
vi.mock("uWebSockets.js", async () => {
  // The three constants and `getParts` are the real ones: the subject compares
  // against `uWS.DISABLED` / `uWS.SHARED_COMPRESSOR` by value, and a stubbed
  // value would make the assertion agree with itself.
  const actual =
    await vi.importActual<typeof import("uWebSockets.js")>("uWebSockets.js");
  const uWSMocks = await import("../../../mocks/uWS");

  return {
    default: {
      App: () => new uWSMocks.MockApp(),
      DISABLED: actual.DISABLED,
      getParts: actual.getParts,
      SHARED_COMPRESSOR: actual.SHARED_COMPRESSOR,
    },
  };
});

async function loadSubject() {
  vi.resetModules();

  const [{ default: HttpWs }, { default: HttpMessage }, { KuzzleRequest }] =
    await Promise.all([
      import("../../../../lib/core/network/protocols/httpwsProtocol"),
      import("../../../../lib/core/network/protocols/httpMessage"),
      import("../../../../lib/api/request"),
    ]);

  return { HttpMessage, HttpWs, KuzzleRequest };
}

const entryPointConfig = () => ({
  maxRequestSize: "1MB",
  port: 7512,
  http: { accessControlAllowOrigin: "foo" },
  protocols: {
    http: {
      additionalContentTypes: [],
      allowCompression: true,
      enabled: true,
      maxEncodingLayers: 3,
      maxFormFileSize: "1MB",
    },
    websocket: {
      compression: false,
      enabled: true,
      idleTimeout: 60000,
      rateLimit: 0,
      resetIdleTimeoutOnSend: false,
      sendPingsAutomatically: false,
    },
  },
});

describe("core/network/protocols/httpwsProtocol", () => {
  let HttpWs: any;
  let HttpMessage: any;
  let KuzzleRequest: any;
  let ClientConnection: any;
  let HttpStream: any;
  let BadRequestError: any;
  let ForbiddenError: typeof import("../../../../lib/kerror/errors").ForbiddenError;
  let entryPoint: EntryPointStub;
  let httpWs: any;
  let route: ReturnType<typeof vi.fn>;
  let warn: ReturnType<typeof vi.fn>;

  const app = (): MockApp => httpWs.server;

  beforeEach(async () => {
    vi.clearAllMocks();

    const loaded = await loadSubject();
    const [connectionModule, typesModule, errorsModule, { loadConfig }] =
      await Promise.all([
        import("../../../../lib/core/network/clientConnection"),
        import("../../../../lib/types"),
        import("../../../../lib/kerror/errors"),
        import("../../../../lib/config"),
      ]);

    HttpWs = loaded.HttpWs;
    HttpMessage = loaded.HttpMessage;
    KuzzleRequest = loaded.KuzzleRequest;
    ClientConnection = connectionModule.default;
    HttpStream = typesModule.HttpStream;
    BadRequestError = errorsModule.BadRequestError;
    ForbiddenError = errorsModule.ForbiddenError;

    route = vi.fn();
    warn = vi.fn();

    const config = structuredClone(loadConfig());

    config.http.accessControlAllowOrigin = ["foo"];
    config.http.cookieAuthentication = true;
    config.internal.allowAllOrigins = false;

    const logger = { debug: warn, error: warn, info: warn, trace: warn, warn };

    stubKuzzle({
      config,
      log: { child: () => logger },
      // Identity: every pipe in this subject is destructured as `{ payload }`
      // out of the object it was handed.
      pipe: vi.fn(async (_event: string, payload: unknown) => payload),
      router: { http: { route } },
    });

    entryPoint = stubEntryPoint(entryPointConfig());
    httpWs = new HttpWs();
  });

  afterEach(() => {
    clearInterval(httpWs?.nowInterval);
    restoreKuzzle();
  });

  const init = () => httpWs.init(asEntryPoint(entryPoint));

  /** The subject answers HTTP in background tasks. */
  const untilEnded = async (response: MockHttpResponse) => {
    for (let i = 0; !response.tryEnd.mock.calls.length && i < 50; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    return response;
  };

  const headerCalls = (response: MockHttpResponse) =>
    response.writeHeader.mock.calls.map(([name, value]) => [
      String(name),
      String(value),
    ]);

  describe("http configuration & initialization", () => {
    it("disables http when no configuration is found", async () => {
      entryPoint.config.protocols.http = undefined;

      await init();

      expect(app().any).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        "[http] no configuration found for http: disabling it",
      );
    });
  });

  describe("#httpWriteRequestHeaders", () => {
    it("writes one set-cookie header per configured cookie", async () => {
      await init();

      const connection = new ClientConnection("http", ["1.2.3.4"], "foo");
      const message = new HttpMessage(
        connection,
        asHttpRequest(
          new MockHttpRequest("", "", "", {
            origin: "foo",
            "Content-Length": "42",
          }),
        ),
      );
      const response = new MockHttpResponse();
      const request = new KuzzleRequest({});

      request.response.configure({ headers: { "set-cookie": "foo=bar" } });
      request.response.configure({ headers: { "set-cookie": "bar=baz" } });

      httpWs.httpWriteRequestHeaders(request, response, message);

      expect(headerCalls(response)).toEqual(
        expect.arrayContaining([
          ["Set-Cookie", "foo=bar"],
          ["Set-Cookie", "bar=baz"],
        ]),
      );
    });
  });

  describe("#httpSendError", () => {
    let connection: any;
    let message: any;

    beforeEach(async () => {
      await init();

      connection = new ClientConnection("http", ["1.2.3.4"], "foo");
      message = new HttpMessage(
        connection,
        asHttpRequest(
          new MockHttpRequest("", "", "", {
            origin: "foo",
            "Content-Length": "42",
          }),
        ),
      );
    });

    it("writes the status, the CORS headers and the serialized error, in order", () => {
      const response = new MockHttpResponse();

      httpWs.httpSendError(
        message,
        response,
        new BadRequestError("ohnoes", "foo.bar"),
      );

      expect(response.cork).toHaveBeenCalledTimes(1);
      expect(response.cork.mock.invocationCallOrder[0]).toBeLessThan(
        response.writeStatus.mock.invocationCallOrder[0],
      );

      expect(response.writeStatus).toHaveBeenCalledTimes(1);
      expect(String(response.writeStatus.mock.calls[0][0])).toBe("400");
      expect(response.writeStatus.mock.invocationCallOrder[0]).toBeLessThan(
        response.writeHeader.mock.invocationCallOrder[0],
      );

      const headers = headerCalls(response);

      expect(headers).toEqual(
        expect.arrayContaining([
          [
            "Access-Control-Allow-Headers",
            global.kuzzle.config.http.accessControlAllowHeaders,
          ],
          [
            "Access-Control-Allow-Methods",
            global.kuzzle.config.http.accessControlAllowMethods,
          ],
          ["Access-Control-Allow-Origin", "foo"],
          ["Content-Type", "application/json"],
        ]),
      );
      expect(headers.map(([name]) => name)).not.toContain("Content-Length");

      expect(response.end).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(response.end.mock.calls[0][0]))).toMatchObject({
        id: "foo.bar",
        status: 400,
      });

      expect(entryPoint.removeConnection.mock.calls).toEqual([[connection.id]]);
    });

    it("wraps a non-Kuzzle error", () => {
      const response = new MockHttpResponse();

      httpWs.httpSendError(message, response, new Error("ohnoes"));

      expect(response.end).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(response.end.mock.calls[0][0]))).toMatchObject({
        id: "network.http.unexpected_error",
        status: 400,
      });
      expect(JSON.parse(String(response.end.mock.calls[0][0])).message).toMatch(
        /ohnoes/,
      );
    });

    it("writes nothing when the client connection is aborted", () => {
      const response = new MockHttpResponse();

      response.aborted = true;

      httpWs.httpSendError(message, response, new Error("ohnoes"));

      expect(entryPoint.removeConnection.mock.calls).toEqual([[connection.id]]);
      expect(response.cork).not.toHaveBeenCalled();
      expect(response.writeStatus).not.toHaveBeenCalled();
      expect(response.writeHeader).not.toHaveBeenCalled();
      expect(response.end).not.toHaveBeenCalled();
    });
  });

  describe("#httpSendStream", () => {
    let message: any;
    let request: MockHttpRequest;

    beforeEach(async () => {
      await init();

      const connection = new ClientConnection("http", ["1.2.3.4"], "foo");

      request = new MockHttpRequest("", "", "", { origin: "foo" });
      message = new HttpMessage(connection, asHttpRequest(request));
    });

    it("writes the headers", () => {
      const response = new MockHttpResponse();
      const headers = vi
        .spyOn(httpWs, "httpWriteRequestHeaders")
        .mockImplementation(() => {});

      httpWs.httpSendStream(
        request,
        response,
        new HttpStream(new PassThrough()),
        message,
      );

      expect(response.cork).toHaveBeenCalledTimes(1);
      expect(headers).toHaveBeenCalledTimes(1);
    });

    it("answers an error when the stream is already closed", () => {
      const response = new MockHttpResponse();
      const stream = new PassThrough();
      const sendError = vi
        .spyOn(httpWs, "httpSendError")
        .mockImplementation(() => {});

      stream.destroy();
      httpWs.httpSendStream(request, response, new HttpStream(stream), message);

      expect(sendError).toHaveBeenCalledTimes(1);
      expect(sendError.mock.calls[0][0]).toBe(message);
      expect(sendError.mock.calls[0][1]).toBe(response);
      expect(sendError.mock.calls[0][2]).toMatchObject({
        id: "network.http.stream_closed",
      });
      expect(response.cork).not.toHaveBeenCalled();
    });

    it("writes with tryEnd when the stream size is fixed", () => {
      const response = new MockHttpResponse();
      const stream = new PassThrough();

      vi.spyOn(httpWs, "httpWriteRequestHeaders").mockImplementation(() => {});
      httpWs.httpSendStream(
        request,
        response,
        new HttpStream(stream, { totalBytes: 5 }),
        message,
      );

      stream.write("Hello");
      stream.end();

      expect(response.getWriteOffset).toHaveBeenCalledTimes(1);
      expect(response.tryEnd).toHaveBeenCalledTimes(1);
      expect(
        Buffer.from(response.tryEnd.mock.calls[0][0] as ArrayBuffer),
      ).toEqual(Buffer.from("Hello"));
      expect(response.tryEnd.mock.calls[0][1]).toBe(5);
    });

    it("writes with write when the stream size is dynamic", () => {
      const response = new MockHttpResponse();
      const stream = new PassThrough();

      vi.spyOn(httpWs, "httpWriteRequestHeaders").mockImplementation(() => {});
      httpWs.httpSendStream(request, response, new HttpStream(stream), message);

      stream.write("Hello");
      stream.end();

      expect(response.getWriteOffset).toHaveBeenCalledTimes(1);
      expect(response.write).toHaveBeenCalledTimes(1);
      expect(
        Buffer.from(response.write.mock.calls[0][0] as ArrayBuffer),
      ).toEqual(Buffer.from("Hello"));
    });

    it.each([
      ["fixed", { totalBytes: 5 }, "tryEnd"],
      ["dynamic", undefined, "write"],
    ])(
      "pauses the stream on backpressure when its size is %s",
      (_name, options, writer) => {
        const response = new MockHttpResponse();
        const stream = new PassThrough();

        if (writer === "tryEnd") {
          response.tryEnd.mockReturnValue([false, false]);
        } else {
          response.write.mockReturnValue(false);
        }

        const pause = vi.spyOn(stream, "pause");

        vi.spyOn(httpWs, "httpWriteRequestHeaders").mockImplementation(
          () => {},
        );
        httpWs.httpSendStream(
          request,
          response,
          new HttpStream(stream, options as never),
          message,
        );

        stream.write("Hello");
        stream.end();

        expect(pause).toHaveBeenCalledTimes(1);
      },
    );
  });

  describe("http message reception", () => {
    let sendError: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      await init();
      sendError = vi
        .spyOn(httpWs, "httpSendError")
        .mockImplementation(() => {});
    });

    const expectRejected = (id: string) => {
      expect(entryPoint.newConnection).not.toHaveBeenCalled();
      expect(route).not.toHaveBeenCalled();
      expect(sendError).toHaveBeenCalledTimes(1);
      expect(sendError.mock.calls[0][1]).toBe(app()._httpResponse);
      expect(sendError.mock.calls[0][2]).toMatchObject({ id });
    };

    it("rejects a request larger than the configured maximum", () => {
      httpWs.maxRequestSize = 1024;

      app()._httpOnMessage("get", "/", "", { "content-length": 1025 });

      expectRejected("network.http.request_too_large");
    });

    it.each([
      ["an unhandled content type", "oh/noes", "unsupported_content"],
      [
        "a supported content type with extraneous characters",
        "serge application/jsoncheval",
        "unsupported_content",
      ],
      [
        "an unhandled charset",
        "application/json; charset=utf-82",
        "unsupported_charset",
      ],
    ])("rejects %s", (_name, contentType, id) => {
      app()._httpOnMessage("get", "/", "", { "content-type": contentType });

      expectRejected(`network.http.${id}`);
    });

    it("rejects a request lying about its content-length", async () => {
      httpWs.maxRequestSize = 8;

      app()._httpOnMessage("get", "/", "", { "content-length": 7 });
      await app()._httpResponse!._onData(
        Buffer.from('{"ahah":"i am a h4ck3r"}'),
      );

      expectRejected("network.http.request_too_large");
    });

    it.each([
      [
        "too many encoding layers",
        "gzip,gzip,gzip,gzip,gzip,gzip,gzip",
        "too_many_encodings",
      ],
      ["an unhandled content encoding", "lol", "unsupported_compression"],
    ])("rejects %s", async (_name, encoding, id) => {
      app()._httpOnMessage("get", "/", "", { "content-encoding": encoding });
      await app()._httpResponse!._onData(Buffer.from("foobar"), true);

      expectRejected(`network.http.${id}`);
    });

    it("rejects a payload it cannot uncompress", async () => {
      app()._httpOnMessage("get", "/", "", { "content-encoding": "gzip" });
      await app()._httpResponse!._onData(Buffer.from("foobar"), true);

      expect(entryPoint.newConnection).not.toHaveBeenCalled();
      expect(route).not.toHaveBeenCalled();
      expect(sendError).toHaveBeenCalledTimes(1);
      expect((sendError.mock.calls[0][2] as { code: string }).code).toBe(
        "Z_DATA_ERROR",
      );
    });

    it("decodes a payload compressed through several layers", async () => {
      const processRequest = vi
        .spyOn(httpWs, "httpProcessRequest")
        .mockImplementation(() => {});

      app()._httpOnMessage("get", "/", "", {
        "content-encoding": "gzip,deflate,identity",
      });
      await app()._httpResponse!._onData(
        zlib.deflateSync(zlib.gzipSync(Buffer.from('{"foo":"bar"}'))),
        true,
      );

      expect(processRequest).toHaveBeenCalledTimes(1);
      expect(
        (processRequest.mock.calls[0][1] as { content: unknown }).content,
      ).toEqual({ foo: "bar" });
    });

    it("gives the connection the request headers", async () => {
      const processRequest = vi
        .spyOn(httpWs, "httpProcessRequest")
        .mockImplementation(() => {});

      app()._httpOnMessage("get", "/", "", {
        "user-agent": "curl/8.0.1",
        "x-kuzzle-volatile": "{}",
      });
      await app()._httpResponse!._onData(Buffer.from(""), true);

      // `ClientConnection`'s doc says an http connection receives the request
      // headers, and it never did: the JavaScript read `request.headers` off a
      // uWS `HttpRequest`, which has no such property (TD-52).
      expect(processRequest).toHaveBeenCalledTimes(1);
      expect(processRequest.mock.calls[0][0]).toBe(app()._httpResponse);
      expect(processRequest.mock.calls[0][1]).toMatchObject({
        connection: {
          headers: { "user-agent": "curl/8.0.1", "x-kuzzle-volatile": "{}" },
        },
      });
    });

    it("assembles a payload submitted in chunks", async () => {
      const processRequest = vi
        .spyOn(httpWs, "httpProcessRequest")
        .mockImplementation(() => {});

      app()._httpOnMessage("get", "/", "", {});

      await app()._httpResponse!._onData(Buffer.from('{"fo'), false);
      await app()._httpResponse!._onData(Buffer.from('o":'), false);
      await app()._httpResponse!._onData(Buffer.from('"ba'), false);
      await app()._httpResponse!._onData(Buffer.from('r"}'), true);

      expect(processRequest).toHaveBeenCalledTimes(1);
      expect(processRequest.mock.calls[0][1]).toMatchObject({
        content: { foo: "bar" },
      });
    });

    it("answers a request with no payload", async () => {
      const processRequest = vi
        .spyOn(httpWs, "httpProcessRequest")
        .mockImplementation(() => {});

      app()._httpOnMessage("get", "/", "", {});
      await app()._httpResponse!._onData(Buffer.from(""), true);

      expect(processRequest.mock.calls[0][1]).toMatchObject({ content: null });
    });

    it("rejects malformed JSON content", async () => {
      app()._httpOnMessage("get", "/", "", {});
      await app()._httpResponse!._onData(Buffer.from("{lol}"), true);

      expectRejected("network.http.body_parse_failed");
    });

    it("parses a multipart/form-data request", async () => {
      const processRequest = vi
        .spyOn(httpWs, "httpProcessRequest")
        .mockImplementation(() => {});

      app()._httpOnMessage("get", "/", "", {
        "content-type": "multipart/form-data; boundary=foo",
      });
      await app()._httpResponse!._onData(
        Buffer.from(
          '--foo\r\nContent-Disposition: form-data; name="t"\r\n\r\nvalue\r\n--foo\r\nContent-Disposition: form-data; name="f"; filename="filename"\r\nContent-Type: application/octet-stream\r\n\r\nfoobar\r\n--foo--',
        ),
        true,
      );

      expect(processRequest.mock.calls[0][1]).toMatchObject({
        content: {
          f: {
            encoding: "application/octet-stream",
            file: "Zm9vYmFy",
            filename: "filename",
          },
          t: "value",
        },
      });
    });

    it("parses an empty multipart/form-data request", async () => {
      const processRequest = vi
        .spyOn(httpWs, "httpProcessRequest")
        .mockImplementation(() => {});

      app()._httpOnMessage("get", "/", "", {
        "content-type": "multipart/form-data; boundary=foo",
      });
      await app()._httpResponse!._onData(
        Buffer.from("--foo\r\nContent-Disposition: form-data; --foo--"),
        true,
      );

      expect(processRequest.mock.calls[0][1]).toMatchObject({ content: {} });
    });

    it("rejects a multipart/form-data file over the configured size", async () => {
      // Configured, not set on the instance: `maxFormFileSize` used to be read
      // off a property production never assigned, so the comparison was
      // `byteLength > undefined` and the limit was never enforced (TD-52).
      entryPoint.config.protocols.http.maxFormFileSize = 2;
      await init();

      app()._httpOnMessage("get", "/", "", {
        "content-type": "multipart/form-data; boundary=foo",
      });
      await app()._httpResponse!._onData(
        Buffer.from(
          '--foo\r\nContent-Disposition: form-data; name="t"\r\n\r\nvalue\r\n--foo\r\nContent-Disposition: form-data; name="f"; filename="filename"\r\nContent-Type: application/octet-stream\r\n\r\nfoobar\r\n--foo--',
        ),
        true,
      );

      expect(sendError).toHaveBeenCalledTimes(1);
      expect(sendError.mock.calls[0][2]).toMatchObject({
        id: "network.http.file_too_large",
      });
    });

    it("parses an application/x-www-form-urlencoded request", async () => {
      const processRequest = vi
        .spyOn(httpWs, "httpProcessRequest")
        .mockImplementation(() => {});

      app()._httpOnMessage("get", "/", "", {
        "content-type": "application/x-www-form-urlencoded",
      });
      await app()._httpResponse!._onData(Buffer.from("foo=bar&baz=qux"), true);

      expect(processRequest.mock.calls[0][1]).toMatchObject({
        content: { baz: "qux", foo: "bar" },
      });
    });
  });

  describe("http responses", () => {
    beforeEach(() => init());

    const answer = (result: unknown, options?: Record<string, unknown>) => {
      const request = new KuzzleRequest({});

      request.setResult(result, options);
      route.mockImplementation((_message, cb) => cb(request));
    };

    it("forwards a well-formed request to the router and writes its response", async () => {
      answer("yo");

      app()._httpOnMessage("get", "/", "", { origin: "foo" });
      await app()._httpResponse!._onData(
        Buffer.from('{"controller":"foo","action":"bar"}'),
        true,
      );

      expect(entryPoint.newConnection).toHaveBeenCalledTimes(1);

      const response = app()._httpResponse!;

      expect(response.cork).toHaveBeenCalledTimes(1);
      expect(response.cork.mock.invocationCallOrder[0]).toBeLessThan(
        response.writeStatus.mock.invocationCallOrder[0],
      );

      expect(response.writeStatus).toHaveBeenCalledTimes(1);
      expect(String(response.writeStatus.mock.calls[0][0])).toBe("200");

      expect(headerCalls(response)).toEqual(
        expect.arrayContaining([
          [
            "Access-Control-Allow-Headers",
            global.kuzzle.config.http.accessControlAllowHeaders,
          ],
          [
            "Access-Control-Allow-Methods",
            global.kuzzle.config.http.accessControlAllowMethods,
          ],
          ["Access-Control-Allow-Origin", "foo"],
          ["Content-Type", "application/json"],
          ["Content-Encoding", "identity"],
        ]),
      );

      expect(response.tryEnd).toHaveBeenCalledTimes(1);
      expect(
        JSON.parse(String(response.tryEnd.mock.calls[0][0])),
      ).toMatchObject({ error: null, result: "yo", status: 200 });

      expect(entryPoint.removeConnection).toHaveBeenCalledTimes(1);
    });

    it("lets the response override a default header rather than duplicating it", async () => {
      answer("yo", {
        headers: {
          "Access-Control-Allow-Headers": "foo",
          "Access-Control-Allow-Methods": "foo",
          "Access-Control-Allow-Origin": "foo",
          "Content-Type": "foo",
        },
      });

      app()._httpOnMessage("get", "/", "", { origin: "foobar" });
      await app()._httpResponse!._onData(
        Buffer.from('{"controller":"foo","action":"bar"}'),
        true,
      );

      const response = app()._httpResponse!;
      const headers = headerCalls(response);

      expect(headers).toEqual(
        expect.arrayContaining([
          ["Access-Control-Allow-Headers", "foo"],
          ["Access-Control-Allow-Methods", "foo"],
          ["Access-Control-Allow-Origin", "foo"],
          ["Content-Type", "foo"],
        ]),
      );

      // The defaults, and the origin the request came in with, are not written
      // a second time.
      expect(headers).not.toEqual(
        expect.arrayContaining([
          [
            "Access-Control-Allow-Headers",
            global.kuzzle.config.http.accessControlAllowHeaders,
          ],
        ]),
      );
      expect(headers).not.toEqual(
        expect.arrayContaining([["Access-Control-Allow-Origin", "foobar"]]),
      );
      expect(headers).not.toEqual(expect.arrayContaining([["Vary", "Origin"]]));
      expect(headers).not.toEqual(
        expect.arrayContaining([["Content-Type", "application/json"]]),
      );

      expect(response.tryEnd).toHaveBeenCalledTimes(1);
      expect(
        JSON.parse(String(response.tryEnd.mock.calls[0][0])),
      ).toMatchObject({ error: null, result: "yo", status: 200 });
    });

    it("writes a custom X-Kuzzle-Request-Id header", async () => {
      answer("yo", { headers: { "X-Kuzzle-Request-Id": "my-custom-id-42" } });

      app()._httpOnMessage("get", "/", "", { origin: "foobar" });
      await app()._httpResponse!._onData(
        Buffer.from('{"controller":"foo","action":"bar"}'),
        true,
      );

      expect(headerCalls(app()._httpResponse!)).toEqual(
        expect.arrayContaining([["X-Kuzzle-Request-Id", "my-custom-id-42"]]),
      );
    });

    it.each([
      ["gzip", "gzip", "gunzipSync"],
      ["deflate", "deflate", "inflateSync"],
      [
        "gzip when several algorithms are accepted",
        "deflate, deflate, deflate, identity, gzip, deflate",
        "gunzipSync",
      ],
      [
        "deflate when the header ranks it first",
        "deflate;q=0.8, gzip;q=0.25, *=0",
        "inflateSync",
      ],
    ])(
      "compresses the response with %s",
      async (_name, acceptEncoding, decoder) => {
        answer("yo");

        app()._httpOnMessage("get", "/", "", {
          "accept-encoding": acceptEncoding,
        });
        app()._httpResponse!._onData("", true);

        const response = await untilEnded(app()._httpResponse!);

        expect(response.tryEnd).toHaveBeenCalledTimes(1);

        const payload = (
          zlib as unknown as Record<string, (b: Buffer) => Buffer>
        )[decoder](Buffer.from(response.tryEnd.mock.calls[0][0] as never));

        expect(JSON.parse(payload.toString())).toMatchObject({
          error: null,
          result: "yo",
          status: 200,
        });
        expect(headerCalls(response)).toEqual(
          expect.arrayContaining([
            ["Content-Encoding", decoder === "gunzipSync" ? "gzip" : "deflate"],
          ]),
        );
      },
    );

    it("falls back to identity when no accepted algorithm is supported", async () => {
      answer("yo");

      app()._httpOnMessage("get", "/", "", {
        "accept-encoding": "br;q=0.8, compress;q=0.25",
      });
      app()._httpResponse!._onData("", true);

      const response = await untilEnded(app()._httpResponse!);

      expect(response.tryEnd).toHaveBeenCalledTimes(1);
      expect(
        JSON.parse(String(response.tryEnd.mock.calls[0][0])),
      ).toMatchObject({ error: null, result: "yo", status: 200 });
      expect(headerCalls(response)).toEqual(
        expect.arrayContaining([["Content-Encoding", "identity"]]),
      );
    });

    it.each([
      ["gzip", "gzip"],
      ["deflate", "deflate"],
    ])(
      "falls back to identity when %s compression fails",
      async (_name, algorithm) => {
        // The second of the two genuinely per-test substitutions in L4: `zlib`
        // has to fail for this test and work for its neighbours, so this is
        // `vi.doMock` (not hoisted) plus a re-import, undone in a `finally`.
        vi.doMock("node:zlib", async () => {
          const actual =
            await vi.importActual<typeof import("node:zlib")>("node:zlib");

          return {
            default: {
              ...actual,
              [algorithm]: (
                _payload: Buffer,
                cb: (error: Error | null) => void,
              ) => cb(new Error("foo")),
            },
          };
        });

        let protocol: any;

        try {
          const { HttpWs: Fresh } = await loadSubject();

          protocol = new Fresh();
          await protocol.init(asEntryPoint(entryPoint));

          answer("yo");

          protocol.server._httpOnMessage("get", "/", "", {
            "accept-encoding": algorithm,
          });
          protocol.server._httpResponse._onData("", true);

          const response = await untilEnded(protocol.server._httpResponse);

          expect(response.tryEnd).toHaveBeenCalledTimes(1);
          expect(
            JSON.parse(String(response.tryEnd.mock.calls[0][0])),
          ).toMatchObject({ error: null, result: "yo", status: 200 });
          expect(headerCalls(response)).toEqual(
            expect.arrayContaining([["Content-Encoding", "identity"]]),
          );
        } finally {
          clearInterval(protocol?.nowInterval);
          vi.doUnmock("node:zlib");
        }
      },
    );

    it.each([
      ["a string", "yo", "yo"],
      ["null", null, ""],
      ["a JSON object", { foo: "bar" }, '{"foo":"bar"}'],
      ["a Buffer", Buffer.from("foobar"), "foobar"],
      [
        "a stringified Buffer",
        JSON.stringify(Buffer.from("foobar")),
        JSON.stringify(Buffer.from("foobar")),
      ],
      ["a scalar", 123.45, "123.45"],
    ])("sends a raw response unwrapped: %s", async (_name, result, written) => {
      answer(result, { raw: true });

      app()._httpOnMessage("get", "/", "", {});
      await app()._httpResponse!._onData("", true);

      const response = app()._httpResponse!;

      expect(response.tryEnd).toHaveBeenCalledTimes(1);
      expect(String(response.tryEnd.mock.calls[0][0])).toBe(written);
    });
  });

  describe("websocket configuration & initialization", () => {
    it("disables websocket when no configuration is found", async () => {
      entryPoint.config.protocols.websocket = undefined;

      await init();

      expect(app().ws).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        "[websocket] no configuration found for websocket: disabling it",
      );
    });

    it.each([0, 999])(
      "raises an idleTimeout of %i to the minimum",
      async (tooLow) => {
        entryPoint.config.protocols.websocket.idleTimeout = tooLow;

        await init();

        expect(app().ws.mock.calls[0][0]).toBe("/*");
        expect(app().ws.mock.calls[0][1]).toMatchObject({ idleTimeout: 60 });
        expect(warn).toHaveBeenCalledWith(
          '[websocket] The "idleTimeout" parameter can neither be deactivated or be set with a value lower than 1000. Defaulted to 60000.',
        );
      },
    );

    /** @deprecated */
    it('warns about the deprecated "heartbeat" argument', async () => {
      entryPoint.config.protocols.websocket.heartbeat = "foo";

      await init();

      expect(warn).toHaveBeenCalledWith(
        '[websocket] The "heartbeat" parameter has been deprecated and is now ignored. The "idleTimeout" parameter should now be configured instead.',
      );
    });

    it("does not start a server when the protocol is disabled", async () => {
      entryPoint.config.protocols.websocket.enabled = false;

      await init();

      expect(app().ws).not.toHaveBeenCalled();
    });

    it("starts a server from the provided configuration", async () => {
      const uWS = (await import("uWebSockets.js")).default;

      entryPoint.config.protocols.websocket = {
        compression: true,
        enabled: true,
        idleTimeout: 12345,
        rateLimit: 123,
        resetIdleTimeoutOnSend: false,
        sendPingsAutomatically: false,
      };
      entryPoint.config.maxRequestSize = "1kb";

      await init();

      expect(app().ws.mock.calls[0][1]).toMatchObject({
        compression: uWS.SHARED_COMPRESSOR,
        idleTimeout: 12,
        maxPayloadLength: 1024,
        resetIdleTimeoutOnSend: false,
        sendPingsAutomatically: false,
      });
      expect(app().ws.mock.calls[0][1].maxBackPressure).toBeTypeOf("number");

      for (const name of ["upgrade", "open", "message", "close", "drain"]) {
        expect(app().ws.mock.calls[0][1][name]).toBeTypeOf("function");
      }

      // `init()` builds a *new* `uWS.App()`, so the second registration is
      // call 0 of a different server — not call 1 of the same one.
      entryPoint.config.protocols.websocket.compression = false;
      await init();

      expect(app().ws.mock.calls[0][1]).toMatchObject({
        compression: uWS.DISABLED,
      });
    });
  });

  describe("websocket upgrade", () => {
    beforeEach(() => init());

    it("carries the request headers into the upgraded socket's user data", () => {
      const response = new MockHttpResponse();
      const request = new MockHttpRequest("", "", "", {
        cookie: "foo",
        origin: "my-website.com",
        "sec-websocket-key": "websocket-key",
        "sec-websocket-protocol": "websocket-protocol",
        "sec-websocket-extensions": "websocket-extension",
      });
      const context = {};

      app()._wsOnUpgrade(response, request, context);

      expect(response.upgrade).toHaveBeenCalledTimes(1);
      expect(response.upgrade.mock.calls[0][0]).toMatchObject({
        headers: {
          cookie: "foo",
          origin: "my-website.com",
          "sec-websocket-key": "websocket-key",
          "sec-websocket-protocol": "websocket-protocol",
          "sec-websocket-extensions": "websocket-extension",
        },
      });
      expect(response.upgrade.mock.calls[0].slice(1)).toEqual([
        "websocket-key",
        "websocket-protocol",
        "websocket-extension",
        context,
      ]);
    });
  });

  describe("websocket connection lifecycle", () => {
    beforeEach(() => init());

    it("declares the new connection and indexes the socket three ways", () => {
      app()._wsOnOpen();

      expect(entryPoint.newConnection).toHaveBeenCalledTimes(1);

      const connection = entryPoint.newConnection.mock.calls[0][0] as {
        id: string;
        protocol: string;
        ips: string[];
      };

      expect(connection).toMatchObject({
        protocol: "websocket",
        ips: ["1.2.3.4"],
      });
      expect(httpWs.connectionBySocket.get(app()._wsSocket)).toBe(connection);
      expect(httpWs.socketByConnectionId.get(connection.id)).toBe(
        app()._wsSocket,
      );
      expect(httpWs.backpressureBuffer.get(app()._wsSocket)).toEqual([]);
    });

    it("ends gracefully when the closing socket is unknown", () => {
      expect(() => httpWs.wsOnCloseHandler(null, 1001, null)).not.toThrow();
    });

    it("forgets only the closed connection", () => {
      app()._wsOnOpen();
      const openedSocket = app()._wsSocket;
      const openedConnection = entryPoint.newConnection.mock.calls[0][0] as {
        id: string;
      };

      app()._wsNewSocket();
      app()._wsOnOpen();
      const closedSocket = app()._wsSocket;
      const closedConnection = entryPoint.newConnection.mock.calls[1][0] as {
        id: string;
      };

      app()._wsOnClose();

      expect(httpWs.connectionBySocket.get(openedSocket)).toBe(
        openedConnection,
      );
      expect(httpWs.connectionBySocket.has(closedSocket)).toBe(false);

      expect(httpWs.socketByConnectionId.get(openedConnection.id)).toBe(
        openedSocket,
      );
      expect(httpWs.socketByConnectionId.has(closedConnection.id)).toBe(false);

      expect(httpWs.backpressureBuffer.get(openedSocket)).toEqual([]);
      expect(httpWs.backpressureBuffer.has(closedSocket)).toBe(false);
    });
  });

  describe("websocket message handler", () => {
    let socket: any;

    beforeEach(async () => {
      await init();
      app()._wsOnOpen();
      socket = app()._wsSocket;
    });

    const sent = (call = 0) =>
      JSON.parse(String(socket.send.mock.calls[call][0]));

    it.each([
      ["no data", null],
      ["an empty payload", Buffer.from("")],
    ])("discards a message with %s", async (_name, data) => {
      await app()._wsOnMessage(data);

      expect(entryPoint.execute).not.toHaveBeenCalled();
    });

    it("answers immediately when the payload cannot be parsed", async () => {
      await app()._wsOnMessage("{ohnoes}");

      expect(socket.send).toHaveBeenCalledTimes(1);
      expect(socket.send.mock.calls[0][0]).toBeInstanceOf(Buffer);
      expect(sent().error.id).toBe("network.websocket.unexpected_error");
      expect(sent().error.message).toMatch(
        /Caught an unexpected WebSocket error/,
      );
      expect(entryPoint.execute).not.toHaveBeenCalled();
    });

    /**
     * Whatever the `protocol:websocket:afterParsingPayload` pipe fails with,
     * a plugin's own KuzzleError included, the client gets
     * `network.websocket.unexpected_error` (400), as in v2.56.0.
     */
    it("wraps a KuzzleError raised by the afterParsingPayload pipe", async () => {
      vi.mocked(global.kuzzle.pipe).mockImplementation(
        async (event: string, payload: unknown) => {
          if (event === "protocol:websocket:afterParsingPayload") {
            throw new ForbiddenError("forbidden by a plugin", "a.plugin.error");
          }

          return payload;
        },
      );

      await app()._wsOnMessage('{"controller":"foo","action":"bar"}');

      expect(entryPoint.execute).not.toHaveBeenCalled();
      expect(sent()).toMatchObject({
        error: {
          id: "network.websocket.unexpected_error",
          message:
            "Caught an unexpected WebSocket error: forbidden by a plugin",
          status: 400,
        },
        status: 400,
      });
    });

    it("executes a standardized Request from a valid payload", async () => {
      entryPoint.execute.mockImplementation((_connection, _request, cb) =>
        cb({ requestId: "foobar", content: {} }),
      );

      await app()._wsOnMessage('{"controller":"foo","action":"bar"}');

      const connection = entryPoint.newConnection.mock.calls[0][0];

      expect(entryPoint.execute).toHaveBeenCalledTimes(1);
      expect(entryPoint.execute.mock.calls[0][0]).toBe(connection);
      expect(entryPoint.execute.mock.calls[0][0]).toBeInstanceOf(
        ClientConnection,
      );
      expect(entryPoint.execute.mock.calls[0][1]).toBeInstanceOf(KuzzleRequest);
      expect(entryPoint.execute.mock.calls[0][1]).toMatchObject({
        input: { action: "bar", controller: "foo" },
        context: {
          connection: { protocol: "websocket", ips: ["1.2.3.4"] },
        },
      });

      expect(socket.send.mock.calls[0][0]).toBeInstanceOf(Buffer);
      expect(sent()).toMatchObject({ room: "foobar" });
    });

    it("answers an error when the payload cannot become a KuzzleRequest", async () => {
      await app()._wsOnMessage('{"controller": 123}');

      expect(entryPoint.execute).not.toHaveBeenCalled();
      expect(socket.send.mock.calls[0][0]).toBeInstanceOf(Buffer);
      expect(sent()).toMatchObject({
        error: { message: 'Attribute controller must be of type "string"' },
        status: 400,
      });
    });

    it("enforces the configured rate limit", async () => {
      httpWs.wsConfig.rateLimit = 2;

      await app()._wsOnMessage('{"controller":"foo", "action":"bar"}');
      expect(socket.count).toBe(1);
      expect(socket.last).toBe(httpWs.now);
      expect(entryPoint.execute).toHaveBeenCalledTimes(1);

      await app()._wsOnMessage('{"controller":"foo", "action":"bar"}');
      expect(socket.count).toBe(2);
      expect(entryPoint.execute).toHaveBeenCalledTimes(2);

      await app()._wsOnMessage('{"controller":"foo", "action":"bar"}');
      expect(socket.count).toBe(3);
      expect(entryPoint.execute).toHaveBeenCalledTimes(2);

      expect(socket.send.mock.calls[2][0]).toBeInstanceOf(Buffer);
      expect(sent(2)).toMatchObject({
        error: { id: "network.websocket.ratelimit_exceeded" },
        status: 429,
      });
    });

    it("answers an applicative PING with an applicative PONG", async () => {
      await app()._wsOnMessage('{"p":1}');

      expect(entryPoint.execute).not.toHaveBeenCalled();
      expect(socket.send.mock.calls[0][0]).toBeInstanceOf(Buffer);
      expect(String(socket.send.mock.calls[0][0])).toBe('{"p":2}');
    });

    it("routes a PING that also carries a request", async () => {
      entryPoint.execute.mockImplementation((_connection, _request, cb) =>
        cb({ requestId: "foobar", content: {} }),
      );

      await app()._wsOnMessage('{"p":1, "controller": "foo", "action":"bar"}');

      expect(entryPoint.execute).toHaveBeenCalledTimes(1);
      expect(String(socket.send.mock.calls[0][0])).not.toBe('{"p":2}');
    });
  });

  describe("#wsSend", () => {
    let socket: any;

    beforeEach(async () => {
      await init();
      app()._wsOnOpen();
      socket = app()._wsSocket;
    });

    it("discards the response when the socket is unknown", () => {
      httpWs.wsSend({}, Buffer.from("ohnoes"));

      expect(socket.cork).not.toHaveBeenCalled();
      expect(socket.send).not.toHaveBeenCalled();
      expect(socket.end).not.toHaveBeenCalled();
    });

    it("sends directly when backpressure allows it", () => {
      const payload = Buffer.from("foo");

      httpWs.wsSend(socket, payload);

      expect(socket.cork).toHaveBeenCalledTimes(1);
      expect(socket.send.mock.calls).toEqual([[payload]]);
      expect(socket.send.mock.invocationCallOrder[0]).toBeGreaterThan(
        socket.cork.mock.invocationCallOrder[0],
      );
      expect(socket.end).not.toHaveBeenCalled();
      expect(httpWs.backpressureBuffer.get(socket)).toEqual([]);
    });

    it("queues the message when backpressure has built up", () => {
      socket.getBufferedAmount.mockReturnValue(8096);

      const payload = Buffer.from("foo");

      httpWs.wsSend(socket, payload);

      expect(socket.cork).not.toHaveBeenCalled();
      expect(socket.send).not.toHaveBeenCalled();
      expect(socket.end).not.toHaveBeenCalled();
      expect(httpWs.backpressureBuffer.get(socket)).toEqual([payload]);
    });

    it("ends the socket when the backpressure buffer is full", () => {
      httpWs.backpressureBuffer.get(socket).length = 51;
      socket.getBufferedAmount.mockReturnValue(8096);

      httpWs.wsSend(socket, Buffer.from("foo"));

      expect(socket.cork).not.toHaveBeenCalled();
      expect(socket.send).not.toHaveBeenCalled();
      expect(socket.end).toHaveBeenCalledTimes(1);
      expect(socket.end.mock.calls[0][0]).toBe(1011);
      expect(Buffer.from(socket.end.mock.calls[0][1])).toEqual(
        Buffer.from("too much backpressure: client is too slow"),
      );
    });

    it("drains as much of the backpressure as the socket accepts", () => {
      const payload = Buffer.from("payload");
      const backpressure = httpWs.backpressureBuffer.get(socket);

      backpressure.length = 3;
      backpressure.fill(payload, 0);

      socket.getBufferedAmount
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
        .mockReturnValue(8096);

      app()._wsOnDrain();

      expect(socket.cork).toHaveBeenCalledTimes(1);
      expect(socket.send.mock.calls).toEqual([[payload], [payload]]);
      expect(backpressure).toEqual([payload]);
    });
  });

  describe("#disconnect", () => {
    beforeEach(() => init());

    it("ignores an unknown connection id", () => {
      expect(() => httpWs.disconnect("foo")).not.toThrow();
    });

    it.each([
      ["a default message", undefined, "Connection closed by remote host"],
      ["the provided message", "message", "message"],
    ])("ends the client socket with %s", (_name, message, written) => {
      app()._wsOnOpen();

      const socket = app()._wsSocket;
      const connection = entryPoint.newConnection.mock.calls[0][0] as {
        id: string;
      };

      httpWs.disconnect(connection.id, message);

      expect(socket.end.mock.calls[0][0]).toBe(1011);
      expect(Buffer.from(socket.end.mock.calls[0][1] as never)).toEqual(
        Buffer.from(written),
      );
    });
  });

  describe("#joinChannel / #leaveChannel", () => {
    beforeEach(() => init());

    it.each([
      ["joinChannel", "subscribe"],
      ["leaveChannel", "unsubscribe"],
    ])("%s ignores an unknown connection id", (method) => {
      expect(() => httpWs[method]("foo", "bar")).not.toThrow();
    });

    it.each([
      ["joinChannel", "subscribe"],
      ["leaveChannel", "unsubscribe"],
    ])("%s drives the socket's %s", (method, socketMethod) => {
      app()._wsOnOpen();

      const socket = app()._wsSocket as any;
      const connection = entryPoint.newConnection.mock.calls[0][0] as {
        id: string;
      };

      httpWs[method]("foobar", connection.id);

      expect(socket[socketMethod].mock.calls).toEqual([["realtime/foobar"]]);
    });
  });

  describe("#notify", () => {
    let socket: any;

    beforeEach(async () => {
      await init();
      app()._wsOnOpen();
      socket = app()._wsSocket;
    });

    it("ignores an unknown connection id", () => {
      expect(() => httpWs.notify({ connectionId: "foobar" })).not.toThrow();
    });

    it("sends one notification per channel", () => {
      const connection = entryPoint.newConnection.mock.calls[0][0] as {
        id: string;
      };
      const channels = ["a", "b", "c"];

      httpWs.notify({
        channels,
        connectionId: connection.id,
        payload: { foo: "bar" },
      });

      expect(socket.send.mock.calls.map(([p]: [Buffer]) => String(p))).toEqual(
        channels.map((room) => JSON.stringify({ foo: "bar", room })),
      );
    });
  });

  describe("#broadcast", () => {
    beforeEach(async () => {
      await init();
      app()._wsOnOpen();
    });

    it("publishes one notification per channel", () => {
      const channels = ["a", "b", "c"];

      httpWs.broadcast({ channels, payload: { foo: "bar" } });

      expect(
        app().publish.mock.calls.map(([topic, payload]) => [
          topic,
          String(payload),
        ]),
      ).toEqual(
        channels.map((room) => [
          `realtime/${room}`,
          JSON.stringify({ foo: "bar", room }),
        ]),
      );
    });
  });
});
