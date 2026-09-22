import type { HttpRequest } from "uWebSockets.js";
import { vi } from "vitest";

/**
 * The `uWS.HttpRequest` a protocol hands to the router.
 *
 * Derived from `test/mocks/uWS.mock.js`. L4b3 promoted the request alone, with
 * its smallest user; the socket, the response and the `App` came over with
 * L4b4, which is what exercises them.
 */
export class MockHttpRequest {
  public response = {
    removeHeader: vi.fn(),
    setHeader: vi.fn(),
    status: "200 OK",
  };

  private readonly _method: string;

  constructor(
    method = "",
    private readonly _url = "",
    private readonly _qs = "",
    private readonly _headers: Record<string, string> = {},
  ) {
    this._method = method.toUpperCase();
  }

  getQuery() {
    return this._qs;
  }

  getMethod() {
    return this._method;
  }

  getUrl() {
    return this._url;
  }

  forEach(cb: (name: string, value: string) => void) {
    for (const [name, value] of Object.entries(this._headers)) {
      cb(name, value);
    }
  }

  getHeader(name: string) {
    return this._headers[name];
  }
}

/**
 * `HttpMessage` is declared against uWS's own `HttpRequest`, of which the mock
 * implements the five methods the subject calls. The cast lives here, once.
 */
export const asHttpRequest = (mock: MockHttpRequest) =>
  mock as unknown as HttpRequest;

/** A connected websocket, as uWS hands one to the protocol's handlers. */
export class MockSocket {
  public subscribe = vi.fn();
  public unsubscribe = vi.fn();
  public end = vi.fn();
  public getRemoteAddressAsText = vi.fn(() => Buffer.from("1.2.3.4"));
  public cork = vi.fn((fn: () => void) => fn());
  public getBufferedAmount = vi.fn(() => 0);
  public send = vi.fn();
  public headers: Record<string, string> = {};
  public internal: Record<string, unknown> = {};
}

/**
 * A `uWS.HttpResponse`, plus the three handlers uWS would call back into.
 *
 * `onData`, `onWritable` and `onAborted` record what the subject registers;
 * `_onData`, `_onWritable` and `_onAborted` are how a spec plays uWS and fires
 * them.
 */
export class MockHttpResponse {
  private _onDataHandler:
    ((data: ArrayBuffer | string, isLast?: boolean) => unknown) | null = null;
  private _onAbortedHandler: (() => void) | null = null;
  private _onWritableHandler: ((offset: number) => void) | null = null;

  public aborted = false;
  public cork = vi.fn((fn: () => void) => fn());
  public writeStatus = vi.fn();
  public writeHeader = vi.fn();
  public end = vi.fn();
  public getRemoteAddressAsText = vi.fn(() => "1.2.3.4");
  public tryEnd = vi.fn<
    (
      chunk?: ArrayBuffer | string,
      totalSize?: number,
    ) => [boolean, boolean | null]
  >(() => [true, null]);
  public getWriteOffset = vi.fn(() => 0);
  public write = vi.fn<(chunk?: ArrayBuffer | string) => boolean>(() => false);
  public upgrade = vi.fn();

  public onData = vi.fn(
    (handler: (data: ArrayBuffer | string, isLast?: boolean) => unknown) => {
      this._onDataHandler = handler;
    },
  );

  public onWritable = vi.fn((handler: (offset: number) => void) => {
    this._onWritableHandler = handler;
  });

  public onAborted = vi.fn((handler: () => void) => {
    this._onAbortedHandler = handler;
  });

  _onData(data: ArrayBuffer | string, isLast?: boolean) {
    return this._onDataHandler?.(data, isLast);
  }

  _onAborted() {
    this._onAbortedHandler?.();
  }

  _onWritable(offset: number) {
    this._onWritableHandler?.(offset);
  }
}

type WsHandlers = Record<string, (...args: unknown[]) => unknown>;

/** `uWS.App()`, with the handlers the protocol registers played back. */
export class MockApp {
  public _wsConfig: WsHandlers | null = null;
  public _httpMessageHandler:
    ((response: MockHttpResponse, request: MockHttpRequest) => unknown) | null =
    null;
  public _wsSocket = new MockSocket();
  public _httpResponse: MockHttpResponse | null = null;

  public listen = vi.fn((_port: number, cb: (token: unknown) => void) =>
    cb("not null"),
  );
  public publish = vi.fn();
  public getParts = vi.fn(() => []);

  public ws = vi.fn((_path: string, opts: WsHandlers) => {
    this._wsConfig = opts;
  });

  public any = vi.fn(
    (
      _path: string,
      handler: (
        response: MockHttpResponse,
        request: MockHttpRequest,
      ) => unknown,
    ) => {
      this._httpMessageHandler = handler;
    },
  );

  private handler(name: string) {
    const fn = this._wsConfig?.[name];

    if (!fn) {
      throw new Error(`Missing "${name}" handler`);
    }

    return fn;
  }

  _wsNewSocket() {
    this._wsSocket = new MockSocket();
  }

  _wsOnOpen() {
    return this.handler("open")(this._wsSocket);
  }

  _wsOnClose(code?: number, message?: unknown) {
    return this.handler("close")(this._wsSocket, code, message);
  }

  _wsOnMessage(data: unknown) {
    return this.handler("message")(this._wsSocket, data);
  }

  _wsOnDrain() {
    return this.handler("drain")(this._wsSocket);
  }

  _wsOnUpgrade(response: unknown, request: unknown, context: unknown) {
    return this.handler("upgrade")(response, request, context);
  }

  _httpOnMessage(
    method: string,
    url: string,
    qs: string,
    headers: Record<string, string | number>,
  ) {
    this._httpResponse = new MockHttpResponse();

    return this._httpMessageHandler?.(
      this._httpResponse,
      new MockHttpRequest(method, url, qs, headers as Record<string, string>),
    );
  }
}
