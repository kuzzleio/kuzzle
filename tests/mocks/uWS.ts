import type { HttpRequest } from "uWebSockets.js";
import { vi } from "vitest";

/**
 * The `uWS.HttpRequest` a protocol hands to the router.
 *
 * Derived from `test/mocks/uWS.mock.js`, whose remaining Mocha users are
 * `protocols/http` and `protocols/websocket` — the last slice of L4b. Only the
 * request is promoted here, with its smallest user: the socket, the response
 * and the `App` come over when those two land, so nothing sits in the vitest
 * tree unexercised. (Same rule L1b4 set when it retired the mock's fourth
 * user.)
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
