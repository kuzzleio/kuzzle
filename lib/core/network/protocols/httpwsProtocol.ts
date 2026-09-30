/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import querystring from "node:querystring";
import url from "node:url";
import zlib from "node:zlib";

import type { JSONObject } from "../../../types/JSONObject";
import uWS from "uWebSockets.js";

import { Request } from "../../../api/request";
import * as kerror from "../../../kerror";
import { KuzzleError } from "../../../kerror/errors";
import { HttpStream } from "../../../types";
import createDebug from "../../../util/debug";
import { removeStacktrace } from "../../../util/stackTrace";
import { causeOf } from "../../../util/thrown";
import ClientConnection from "../clientConnection";
import type { KuzzleWebSocket } from "../../../types/KuzzleWebSocket";
import HttpMessage from "./httpMessage";
import type { NetworkEntryPoint } from "../networkEntryPoint";
import Protocol from "./protocol";

const debug = createDebug;

const kerrorWS = kerror.wrap("network", "websocket");
const kerrorHTTP = kerror.wrap("network", "http");
const debugWS = debug("kuzzle:network:protocols:websocket");
const debugHTTP = debug("kuzzle:network:protocols:http");

// The idleTimeout option should never be deactivated, so instead we use
// a default value for backward-compatibility
const DEFAULT_IDLE_TIMEOUT = 60000;

// Size (in bytes) of backpressure an individual socket can handle before
// needing to drain
const WS_PER_SOCKET_BACKPRESSURE_BUFFER_SIZE = 4096;

// Size of the backpressure buffer: if a client is too slow to absorb the amount
// of data we need to send to it, then we forcibly close its socket to prevent
// the server to be impacted by it
const WS_BACKPRESSURE_BUFFER_MAX_LENGTH = 50;

// Applicative WebSocket PONG message for browsers
const WS_APP_PONG_RESPONSE = Buffer.from('{"p":2}');

// Used by the broadcast method to build JSON payloads while limiting the
// number of JSON serializations
const JSON_ROOM_PROPERTY = ',"room":"';
const JSON_ENDER = '"}';

// Pre-computed messages & errors
const WS_FORCED_TERMINATION_CODE = 1011;
const WS_BACKPRESSURE_MESSAGE = Buffer.from(
  "too much backpressure: client is too slow",
);
const WS_GENERIC_CLOSE_MESSAGE = Buffer.from(
  "Connection closed by remote host",
);
const WS_RATE_LIMIT_EXCEEDED_ERROR = kerrorWS.get("ratelimit_exceeded");
const HTTP_REQUEST_TOO_LARGE_ERROR = kerrorHTTP.get("request_too_large");
const HTTP_FILE_TOO_LARGE_ERROR = kerrorHTTP.get("file_too_large");

// HTTP-related constants
const HTTP_ALLOWED_CONTENT_TYPES = [
  "application/json",
  "application/x-www-form-urlencoded",
  "multipart/form-data",
];
const HTTP_SKIPPED_HEADERS = new Set(["content-length", "set-cookie"]);
const HTTP_HEADER_CONNECTION = Buffer.from("Connection");
const HTTP_HEADER_ACCESS_CONTROL_ALLOW_ORIGIN = Buffer.from(
  "Access-Control-Allow-Origin",
);
const HTTP_HEADER_SET_COOKIE = Buffer.from("Set-Cookie");
const HTTP_HEADER_VARY = Buffer.from("Vary");
const WILDCARD = Buffer.from("*");
const ORIGIN = Buffer.from("Origin");
const X_KUZZLE_REQUEST_ID = Buffer.from("X-Kuzzle-Request-Id");
const CLOSE = Buffer.from("close");
const CHARSET_REGEX = /charset=([\w-]+)/i;

/**
 * @class HTTPWS
 * Handles both HTTP and WebSocket connections
 */
/**
 * `server.protocols` as this protocol reads it: the `websocket` and `http`
 * blocks of the Kuzzle configuration.
 */
interface HttpWsProtocolConfig {
  websocket: JSONObject;
  http: JSONObject;
}

/**
 * Whatever failed parsing a WebSocket payload, as the error sent back.
 *
 * Always `network.websocket.unexpected_error`, even for a `KuzzleError`: that
 * is what the `protocol:websocket:afterParsingPayload` pipe and `JSON.parse`
 * have always answered, and the pipe hands over what a plugin threw already
 * wrapped as `plugin.runtime.unexpected_error`.
 */
function parsingError(thrown: unknown): KuzzleError {
  const error = causeOf(thrown);

  return kerrorWS.getFrom(error, "unexpected_error", error.message);
}

/**
 * What `new Request()` threw, as the error sent back: a `KuzzleError`
 * (`BadRequestError`) in every in-tree path, forwarded as is.
 */
function asKuzzleError(thrown: unknown): KuzzleError {
  if (thrown instanceof KuzzleError) {
    return thrown;
  }

  return parsingError(thrown);
}

class HttpWsProtocol extends Protocol<HttpWsProtocolConfig> {
  private _server: uWS.TemplatedApp | null;
  private _wsConfig: JSONObject | null;
  private _httpConfig: JSONObject | null;
  public now: number;
  public nowInterval: NodeJS.Timeout;
  public connectionBySocket: Map<KuzzleWebSocket, ClientConnection>;
  public backpressureBuffer: Map<KuzzleWebSocket, Buffer[]>;
  public socketByConnectionId: Map<string, KuzzleWebSocket>;
  public logger: ReturnType<typeof global.kuzzle.log.child>;

  constructor() {
    super("websocket");

    this._server = null;
    this._wsConfig = null;
    this._httpConfig = null;

    // Used to limit the rate of messages on websocket
    this.now = Date.now();
    this.nowInterval = setInterval(() => {
      this.now = Date.now();
    }, 1000);

    // Map<uWS.WebSocket, ClientConnection>
    this.connectionBySocket = new Map();

    // Map<uWS.WebSocket, Array.<Buffer>>
    this.backpressureBuffer = new Map();

    // Map<string, uWS.WebSocket>
    this.socketByConnectionId = new Map();

    this.logger = global.kuzzle.log.child("core:network:protocols:httpws");
  }

  /**
   * The uWebSockets application and the two parsed configuration blocks.
   * All three are built by `init` — the first from the other two, which are
   * themselves parsed out of a configuration only the entry point has — and
   * every one of the seventeen reads below happens in a handler that the
   * server registered, so none of them can run before `init` returned.
   *
   * Declaring them nullable and dereferencing them anyway is the shape
   * `Protocol.entryPoint` had; these accessors answer the same way, once,
   * instead of at each call site.
   */
  get server(): uWS.TemplatedApp {
    if (this._server === null) {
      throw new Error("[http/websocket] no server: init() has not been called");
    }

    return this._server;
  }

  get wsConfig(): JSONObject {
    if (this._wsConfig === null) {
      throw new Error(
        "[http/websocket] no websocket configuration: init() has not been called",
      );
    }

    return this._wsConfig;
  }

  get httpConfig(): JSONObject {
    if (this._httpConfig === null) {
      throw new Error(
        "[http/websocket] no http configuration: init() has not been called",
      );
    }

    return this._httpConfig;
  }

  async init(entryPoint: NetworkEntryPoint): Promise<boolean>;
  /** @deprecated pass the name to the constructor and call `init(entryPoint)` */
  async init(name: null, entryPoint: NetworkEntryPoint): Promise<boolean>;
  async init(...args: Protocol.InitArgs): Promise<boolean> {
    const entrypoint = Protocol.entryPointOf(args);

    // Awaited: the base sets `entryPoint` and `maxRequestSize`, which
    // `parseWebSocketOptions` reads two lines down. It happened to work
    // because that body has no `await` of its own.
    await super.init(entrypoint);

    this.config = entrypoint.config.protocols;

    this._wsConfig = this.parseWebSocketOptions();
    this._httpConfig = this.parseHttpOptions();

    if (!this.wsConfig.enabled && !this.httpConfig.enabled) {
      return false;
    }

    // eslint-disable-next-line new-cap
    this._server = uWS.App();

    if (this.wsConfig.enabled) {
      this.initWebSocket();
    }

    if (this.httpConfig.enabled) {
      this.initHttp();
    }

    this.server.listen(entrypoint.config.port, (socket) => {
      if (!socket) {
        throw new Error(
          `[http/websocket] fatal: unable to listen to port ${entrypoint.config.port}`,
        );
      }
    });

    return true;
  }

  initWebSocket(): void {
    /* eslint-disable sort-keys */
    this.server.ws("/*", {
      ...this.wsConfig.opts,
      maxBackPressure: WS_PER_SOCKET_BACKPRESSURE_BUFFER_SIZE,
      upgrade: this.wsOnUpgradeHandler.bind(this),
      open: this.wsOnOpenHandler.bind(this),
      close: this.wsOnCloseHandler.bind(this),
      message: this.wsOnMessageHandler.bind(this),
      drain: this.wsOnDrainHandler.bind(this),
    });
    /* eslint-enable sort-keys */
  }

  initHttp(): void {
    this.server.any("/*", this.httpOnMessageHandler.bind(this));
  }

  broadcast(data: JSONObject): void {
    const stringified = JSON.stringify(data.payload);
    const payloadByteSize = Buffer.from(stringified).byteLength;
    // 255 bytes should be enough to hold the following:
    //     ,"room":"<channel identifier>"
    // (with current channel encoding, this is less than 100 bytes)
    const payload = Buffer.allocUnsafe(payloadByteSize + 255);

    let offset = payloadByteSize - 1;

    payload.write(stringified, 0);
    payload.write(JSON_ROOM_PROPERTY, offset);

    offset += JSON_ROOM_PROPERTY.length;

    for (const channel of data.channels) {
      // Adds the room property to the message
      payload.write(channel, offset);
      payload.write(JSON_ENDER, offset + channel.length);

      // prevent buffer overwrites due to sending packets being an
      // async method (race condition)
      const payloadLength = offset + channel.length + JSON_ENDER.length;
      const payloadSafeCopy = Buffer.allocUnsafe(payloadLength);

      payload.copy(payloadSafeCopy, 0, 0, payloadLength);

      debugWS(
        'Publishing to channel "realtime/%s": %s',
        channel,
        payloadSafeCopy,
      );
      this.server.publish(`realtime/${channel}`, payloadSafeCopy, false);
    }
  }

  notify(data: JSONObject): void {
    const socket = this.socketByConnectionId.get(data.connectionId);
    debugWS("notify: %a", data);

    if (!socket) {
      return;
    }

    const payload = data.payload;

    for (const channel of data.channels) {
      payload.room = channel;
      this.wsSend(socket, Buffer.from(JSON.stringify(payload)));
    }
  }

  joinChannel(channel: string, connectionId: string): void {
    const socket = this.socketByConnectionId.get(connectionId);

    if (!socket) {
      return;
    }

    debugWS(
      'Subscribing connection ID "%s" to channel "realtime/%s"',
      connectionId,
      channel,
    );
    socket.subscribe(`realtime/${channel}`);
  }

  leaveChannel(channel: string, connectionId: string): void {
    const socket = this.socketByConnectionId.get(connectionId);

    if (!socket) {
      return;
    }

    debugWS(
      'Removing connection ID "%s" from channel "realtime/%s"',
      connectionId,
      channel,
    );

    socket.unsubscribe(`realtime/${channel}`);
  }

  disconnect(connectionId: string, message: string | null = null): void {
    debugWS("[%s] forced disconnect", connectionId);

    const socket = this.socketByConnectionId.get(connectionId);

    if (!socket) {
      return;
    }

    socket.end(
      WS_FORCED_TERMINATION_CODE,
      message ? Buffer.from(message) : WS_GENERIC_CLOSE_MESSAGE,
    );
  }

  wsOnUpgradeHandler(
    res: uWS.HttpResponse,
    req: uWS.HttpRequest,
    context: uWS.us_socket_context_t,
  ): void {
    const headers: Record<string, string> = {};
    // Extract headers from uWS request
    req.forEach((header, value) => {
      headers[header] = value;
    });

    res.upgrade(
      {
        // `last` and `count` are the rate limiter's bookkeeping. Seeding them
        // here is what makes them non-optional on the socket: the limiter
        // incremented `count` on a socket that had never been given one, and
        // only ever read it in the branch that had just written it.
        count: 0,
        headers,
        internal: {},
        last: 0,
      },
      req.getHeader("sec-websocket-key"),
      req.getHeader("sec-websocket-protocol"),
      req.getHeader("sec-websocket-extensions"),
      context,
    );
  }

  wsOnOpenHandler(socket: KuzzleWebSocket): void {
    const ip = Buffer.from(socket.getRemoteAddressAsText()).toString();
    const connection = new ClientConnection(
      this.name,
      [ip],
      socket.headers,
      socket.internal,
    );

    this.entryPoint.newConnection(connection);
    this.connectionBySocket.set(socket, connection);
    this.socketByConnectionId.set(connection.id, socket);
    this.backpressureBuffer.set(socket, []);
  }

  wsOnCloseHandler(
    socket: KuzzleWebSocket,
    code: number,
    message: ArrayBuffer,
  ): void {
    const connection = this.connectionBySocket.get(socket);

    if (!connection) {
      return;
    }

    const reason = Buffer.from(message ?? new ArrayBuffer(0)).toString();

    // This hack is only here to indicate that uWebSockets killed the connection early
    // because the received payload exceeded the configured threshold.
    if (code === 1006 && reason.startsWith("Received too big message")) {
      this.logger.error(
        `[${connection.id}] connection closed: payload exceeded the threshold`,
      );
    }

    if (debugWS.enabled) {
      debugWS(
        "[%s] received a `close` event (CODE: %d, REASON: %s)",
        connection.id,
        code,
        reason,
      );
    }
    this.entryPoint.removeConnection(connection.id);
    this.connectionBySocket.delete(socket);
    this.backpressureBuffer.delete(socket);
    this.socketByConnectionId.delete(connection.id);
  }

  async wsOnMessageHandler(
    socket: KuzzleWebSocket,
    data: ArrayBuffer,
  ): Promise<void> {
    if (!data || data.byteLength === 0) {
      return;
    }

    const connection = this.connectionBySocket.get(socket);

    // A socket with no connection is one `wsOnCloseHandler` has already torn
    // down: there is nothing left to answer on, not even a rate-limit error.
    // The six reads below took that on trust.
    if (connection === undefined) {
      return;
    }

    // enforce rate limits
    if (this.wsConfig.rateLimit > 0) {
      if (socket.last === this.now) {
        socket.count++;

        if (socket.count > this.wsConfig.rateLimit) {
          this.wsSendError(socket, connection, WS_RATE_LIMIT_EXCEEDED_ERROR);
          return;
        }
      } else {
        socket.last = this.now;
        socket.count = 1;
      }
    }

    let parsed;
    let message = Buffer.from(data).toString();

    debugWS("[%s] client message: %s", connection.id, message);

    ({ payload: message } = await global.kuzzle.pipe(
      "protocol:websocket:beforeParsingPayload",
      { connection, payload: message },
    ));

    try {
      ({ payload: parsed } = await global.kuzzle.pipe(
        "protocol:websocket:afterParsingPayload",
        { connection, payload: JSON.parse(message) },
      ));
    } catch (e) {
      /*
       we cannot add a "room" information since we need to extract
       a request ID from the incoming data, which is apparently
       not a valid JSON
       So... the error is forwarded to the client, hoping they know
       what to do with it.
       */
      this.wsSendError(socket, connection, parsingError(e));
      return;
    }

    if (parsed.p && parsed.p === 1 && Object.keys(parsed).length === 1) {
      debugWS('[%s] sending back a "pong" message', connection.id);
      this.wsSend(socket, WS_APP_PONG_RESPONSE);
      return;
    }

    let request;

    try {
      request = new Request(parsed, { connection });
    } catch (e) {
      this.wsSendError(socket, connection, asKuzzleError(e), parsed.requestId);
      return;
    }

    this.entryPoint.execute(connection, request, (result) => {
      if (result.content) {
        if (typeof result.content === "object") {
          result.content.room = result.requestId;
        }
      } else {
        result.content = "";
      }

      this.wsSend(socket, Buffer.from(JSON.stringify(result.content)));
    });
  }

  /**
   * Absorb as much of the backpressure buffer as possible
   * @param  {uWS.WebSocket} socket
   */
  wsOnDrainHandler(socket: KuzzleWebSocket): void {
    socket.cork(() => {
      const buffer = this.backpressureBuffer.get(socket);

      if (buffer === undefined) {
        return;
      }

      // Drain until the socket fills up again, or until there is nothing left
      // to drain — which is what `shift()` answering `undefined` means.
      while (
        socket.getBufferedAmount() < WS_PER_SOCKET_BACKPRESSURE_BUFFER_SIZE
      ) {
        const payload = buffer.shift();

        if (payload === undefined) {
          break;
        }

        socket.send(payload);
      }
    });
  }

  /**
   * Forwards an error to a socket
   *
   * @param  {uWS.WebSocket} socket
   * @param  {ClientConnection} connection
   * @param  {Error} error
   * @param  {String} requestId @optional
   */
  wsSendError(
    socket: KuzzleWebSocket,
    connection: ClientConnection,
    error: KuzzleError,
    requestId?: string,
  ): void {
    const request = new Request({}, { connection, error });

    // If a requestId is provided we use it instead of the generated one
    request.id = requestId || request.id;

    const sanitized = removeStacktrace(request.response.toJSON()).content;

    this.wsSend(socket, Buffer.from(JSON.stringify(sanitized)));
  }

  /**
   * Sends a message immediately, or queue it up for later if backpressure built
   * up
   *
   * @param  {uWS.WebSocket} socket
   * @param  {Buffer} payload
   */
  wsSend(socket: KuzzleWebSocket, payload: Buffer): void {
    // The three socket maps are written by `wsOnOpenHandler` and cleared by
    // `wsOnCloseHandler`, together: a socket with no backpressure buffer is a
    // socket with no connection. Asking the map that is about to be read
    // answers both questions at once, and replaces a `has()`-then-`get()`
    // pair on two different maps.
    const buffer = this.backpressureBuffer.get(socket);

    if (buffer === undefined) {
      return;
    }

    if (socket.getBufferedAmount() < WS_PER_SOCKET_BACKPRESSURE_BUFFER_SIZE) {
      socket.cork(() => socket.send(payload));
    } else {
      buffer.push(payload);

      /**
       * Client socket too slow: we need to close it
       *
       * If the socket is marked as a debugSession, we don't close it
       * the debugger might send a lot of messages and we don't want to
       * loose the connection while debugging and loose important information.
       */
      if (
        !socket.internal.debugSession &&
        buffer.length > WS_BACKPRESSURE_BUFFER_MAX_LENGTH
      ) {
        socket.end(WS_FORCED_TERMINATION_CODE, WS_BACKPRESSURE_MESSAGE);
      }
    }
  }

  /**
   * @param  {uWS.HttpResponse} response
   * @param  {uWS.HttpRequest} request
   */
  httpOnMessageHandler(
    response: uWS.HttpResponse,
    request: uWS.HttpRequest,
  ): void {
    // Collected once, here, and handed to both: a uWS `HttpRequest` has no
    // `headers` property, so the JavaScript's `request.headers` was `undefined`
    // and every HTTP connection carried `{}` — despite `ClientConnection`'s own
    // doc promising the request headers (TD-52).
    const headers = getRequestHeaders(request);
    const connection = new ClientConnection(
      "HTTP/1.1",
      getHttpIps(response, request),
      headers,
    );
    const message = new HttpMessage(connection, request, headers);

    debugHTTP("[%s] Received HTTP request: %a", connection.id, message);

    // `Number(...)`: a header value is a string, and the JavaScript relied on
    // `>` coercing it. Same comparison, spelled.
    if (Number(message.headers["content-length"]) > this.maxRequestSize) {
      this.httpSendError(message, response, HTTP_REQUEST_TOO_LARGE_ERROR);
      return;
    }

    const contentTypeHeader = message.headers["content-type"];

    if (contentTypeHeader) {
      const contentTypeParamIndex = contentTypeHeader.indexOf(";");
      const contentType =
        contentTypeParamIndex !== -1
          ? contentTypeHeader.slice(0, contentTypeParamIndex).trim()
          : contentTypeHeader.trim();

      if (!this.httpConfig.opts.allowedContentTypes.includes(contentType)) {
        this.httpSendError(
          message,
          response,
          kerrorHTTP.get("unsupported_content", contentType),
        );
        return;
      }

      // Inside the branch now: a charset is declared by the content-type
      // header, so with no header there is nothing to read one out of. The
      // regex used to be run against `undefined`, which stringifies to
      // "undefined" and matches nothing — the same answer, by accident.
      const charset = CHARSET_REGEX.exec(contentTypeHeader)?.[1];

      if (charset !== undefined && charset.toLowerCase() !== "utf-8") {
        this.httpSendError(
          message,
          response,
          kerrorHTTP.get("unsupported_charset", charset.toLowerCase()),
        );
        return;
      }
    }

    this.httpReadData(message, response, (err) => {
      if (err) {
        this.httpSendError(message, response, err);
        return;
      }

      this.httpProcessRequest(response, message);
    });
  }

  /**
   * Read an HTTP payload data
   *
   * @param  {HttpMessage} message
   * @param  {uWS.HttpResponse} response
   * @param  {Function} cb
   */
  httpReadData(
    message: HttpMessage,
    response: uWS.HttpResponse,
    cb: (error?: Error) => void,
  ): void {
    let payload: Buffer | null = null;
    response.aborted = false;

    response.onData((data, isLast) => {
      const chunk = Buffer.from(data);

      payload = payload
        ? Buffer.concat([payload, chunk])
        : Buffer.concat([chunk]);

      /*
       * The content-length header can be bypassed and
       * is not reliable enough. We have to enforce the HTTP
       * max size limit while reading chunks too
       */
      if (payload.byteLength > this.maxRequestSize) {
        cb(HTTP_REQUEST_TOO_LARGE_ERROR);
        return;
      }

      if (!isLast) {
        return;
      }

      if (payload.byteLength === 0) {
        cb();
        return;
      }

      let resolve: (value?: unknown) => void;
      const promise = new Promise((res) => (resolve = res));

      this.httpUncompress(message, payload, async (err, inflated) => {
        if (err) {
          cb(err);
          resolve();
          return;
        }

        const { payload: newPayload } = await global.kuzzle.pipe(
          "protocol:http:beforeParsingPayload",
          { message, payload: inflated },
        );
        await this.httpParseContent(message, newPayload, cb);
        resolve();
      });

      return promise;
    });

    // Beware: the "response" object might be invalidated at any point of time,
    // whenever the connection gets closed by the client for instance
    response.onAborted(() => {
      response.aborted = true;
    });
  }

  async httpParseContent(
    message: HttpMessage,
    content: Buffer,
    cb: (error?: Error) => void,
  ): Promise<void> {
    const type = message.headers["content-type"] || "";

    if (type.includes("multipart/form-data")) {
      if (!this.httpParseMultipart(message, content, type)) {
        cb(HTTP_FILE_TOO_LARGE_ERROR);
        return;
      }
    } else if (type.includes("application/x-www-form-urlencoded")) {
      message.content = querystring.parse(content.toString());
    } else {
      try {
        const { payload } = await global.kuzzle.pipe(
          "protocol:http:afterParsingPayload",
          { message, payload: JSON.parse(content.toString()) },
        );
        message.content = payload;
      } catch {
        // The parser error is deliberately dropped: `body_parse_failed` already
        // carries the offending payload, and the raw message leaks internals of
        // whichever parser ran to the client.
        cb(
          kerrorHTTP.get("body_parse_failed", content.toString().slice(0, 50)),
        );
        return;
      }
    }

    cb();
  }

  /**
   * Fills `message.content` from a multipart/form-data payload, file parts
   * base64-encoded and the rest read as text.
   *
   * Returns false when a part is over the configured `maxFormFileSize`, leaving
   * the caller to raise the error — a boolean rather than a throw so
   * `httpParseContent` keeps answering through its callback, and split out of
   * it to stay under the cognitive complexity ceiling the `.js` → `.ts` rename
   * re-scores as new code.
   */
  private httpParseMultipart(
    message: HttpMessage,
    content: Buffer,
    contentType: string,
  ): boolean {
    // Handed down rather than read off the message again: the caller only
    // reaches here because it read that header and found "multipart/form-data"
    // in it.
    const parts = uWS.getParts(content, contentType);

    message.content = {};

    if (!parts) {
      return true;
    }

    for (const part of parts) {
      if (part.data.byteLength > this.httpConfig.opts.maxFormFileSize) {
        return false;
      }

      message.content[part.name] = part.filename
        ? {
            encoding: part.type,
            file: Buffer.from(part.data).toString("base64"),
            filename: part.filename,
          }
        : Buffer.from(part.data).toString();
    }

    return true;
  }

  httpProcessRequest(response: uWS.HttpResponse, message: HttpMessage): void {
    debugHTTP("[%s] httpProcessRequest: %a", message.connection.id, message);

    if (response.aborted) {
      return;
    }

    this.entryPoint.newConnection(message.connection);

    global.kuzzle.router.http.route(message, (request) => {
      this.entryPoint.logAccess(message.connection, request, message);
      this.entryPoint.removeConnection(message.connection.id);

      if (response.aborted) {
        return;
      }

      if (request.result instanceof HttpStream) {
        this.httpSendStream(request, response, request.result, message);
        return;
      }

      // Send the response in one go

      const data = this.httpRequestToResponse(request, message);

      this.httpCompress(message, data, (result) => {
        if (response.aborted) {
          return;
        }

        request.response.setHeader("Content-Encoding", result.encoding);

        response.cork(() => {
          this.httpWriteRequestHeaders(request, response, message);

          const [success] = response.tryEnd(
            result.compressed,
            result.compressed.length,
          );

          if (!success) {
            response.onWritable((offset) => {
              const retryData = result.compressed.subarray(offset);
              const [retrySuccess] = response.tryEnd(
                retryData,
                retryData.length,
              );

              return retrySuccess;
            });
          }
        });
      });
    });
  }

  /**
   *
   * @param {uWS.HttpRequest} request
   * @param {uWS.HttpResponse} response
   * @param {HttpMessage} message
   */
  httpWriteRequestHeaders(
    request: Request,
    response: uWS.HttpResponse,
    message: HttpMessage,
  ): void {
    response.writeStatus(Buffer.from(request.response.status.toString()));

    response.writeHeader(HTTP_HEADER_CONNECTION, CLOSE);
    response.writeHeader(X_KUZZLE_REQUEST_ID, message.requestId);

    for (const header of this.httpConfig.headers) {
      // If header is missing, add the default one
      if (request.response.headers[header[2]] === undefined) {
        response.writeHeader(header[0], header[1]);
      }
    }

    // Access-Control-Allow-Origin Logic
    if (
      request.response.headers["Access-Control-Allow-Origin"] === undefined &&
      message.headers?.origin
    ) {
      response.writeHeader(
        HTTP_HEADER_ACCESS_CONTROL_ALLOW_ORIGIN,
        Buffer.from(message.headers.origin),
      );

      response.writeHeader(HTTP_HEADER_VARY, ORIGIN);
    }

    if (request.response.headers["set-cookie"]) {
      for (const cookie of request.response.headers["set-cookie"]) {
        response.writeHeader(HTTP_HEADER_SET_COOKIE, Buffer.from(cookie));
      }
    }

    for (const [key, value] of Object.entries(request.response.headers)) {
      // Skip some headers that are not allowed to be sent or modified
      if (HTTP_SKIPPED_HEADERS.has(key.toLowerCase())) {
        continue;
      }

      response.writeHeader(Buffer.from(key), Buffer.from(value.toString()));
    }
  }

  /**
   * Send stream data thorugh the HTTP response
   * @param {HttpRequest} request
   * @param {HttpStream} httpStream - The data stream to send
   * @param {uWS.HttpResponse} response
   * @param {HttpMessage} message
   */
  httpSendStream(
    request: Request,
    response: uWS.HttpResponse,
    httpStream: HttpStream,
    message: HttpMessage,
  ): void {
    const streamSizeFixed =
      typeof httpStream.totalBytes === "number" && httpStream.totalBytes > 0;

    if (httpStream.errored) {
      this.httpSendError(
        message,
        response,
        kerror.get(
          "network",
          "http",
          "stream_errored",
          httpStream.error.message,
        ),
      );
      return;
    }

    if (httpStream.destroyed) {
      this.httpSendError(
        message,
        response,
        kerror.get("network", "http", "stream_closed"),
      );
      return;
    }

    // Remove Content-Length header to avoid a conflict with the
    // Transfer-Encoding header. `setHeader(name, null)` was the spelling, and
    // it sets the header to the string "null" — `String(value)` — rather than
    // removing anything. It went unnoticed because `httpWriteRequestHeaders`
    // skips content-length on its way to the wire.
    request.response.removeHeader("Content-Length");

    // Send Headers in one go
    response.cork(() => {
      this.httpWriteRequestHeaders(request, response, message);
    });

    httpStream.stream.on("data", (chunk) => {
      // Make a copy of the array buffer
      const arrayBuffer = chunk.buffer.slice(
        chunk.byteOffset,
        chunk.byteOffset + chunk.byteLength,
      );

      const arrayBufferOffset = response.getWriteOffset();

      let backpressure;

      /**
       * Switch method of writing data to the response
       * based on the size of the stream.
       * If the stream has a fixed size we can use the tryEnd method
       */
      if (streamSizeFixed) {
        const [success, done] = response.tryEnd(
          arrayBuffer,
          httpStream.totalBytes,
        );
        backpressure = !success;

        if (done) {
          httpStream.destroy();
          return;
        }
      } else {
        const success = response.write(arrayBuffer);

        backpressure = !success;
      }

      // In case of backpressure we need to wait for drainage before sending more data
      if (backpressure) {
        response.arrayBufferOffset = arrayBufferOffset;
        response.arrayBuffer = arrayBuffer;
        httpStream.stream.pause();

        /**
         * When the stream is drained we can resume sending data,
         * only if the is no backpressure after we wrote the missing chunk data.
         */
        response.onWritable((offset) => {
          if (!streamSizeFixed && offset - response.arrayBufferOffset === 0) {
            httpStream.stream.resume();
            return true;
          }

          let retryBackpressure;
          const remainingChunkData = response.arrayBuffer.slice(
            offset - response.arrayBufferOffset,
          );

          if (streamSizeFixed) {
            const [success] = response.tryEnd(
              remainingChunkData,
              httpStream.totalBytes,
            );

            retryBackpressure = !success;
          } else {
            const success = response.write(remainingChunkData);

            retryBackpressure = !success;
          }

          if (!retryBackpressure) {
            httpStream.stream.resume();
          }

          return !retryBackpressure;
        });
      }
    });

    httpStream.stream.on("end", () => {
      if (httpStream.destroy()) {
        response.end();
      }
    });

    httpStream.stream.on("close", () => {
      if (httpStream.destroy()) {
        response.end();
      }
    });

    httpStream.stream.on("error", (err) => {
      if (httpStream.destroy()) {
        response.end();
      }

      debugHTTP("[%s] httpSendStream: %s", message.connection.id, err.message);
    });

    response.onAborted(() => {
      httpStream.destroy();
    });
  }

  /**
   * Forward an error response to the client
   *
   * @param {HttpMessage} message
   * @param {uWS.HttpResponse} response
   * @param {Error} error
   */
  httpSendError(
    message: HttpMessage,
    response: uWS.HttpResponse,
    error: Error,
  ): void {
    const kerr =
      error instanceof KuzzleError
        ? error
        : kerrorHTTP.getFrom(error, "unexpected_error", error.message);

    const content = Buffer.from(JSON.stringify(removeStacktrace(kerr)));

    debugHTTP("[%s] httpSendError: %a", message.connection.id, kerr);

    this.entryPoint.logAccess(
      message.connection,
      new Request(message, {
        connectionId: message.connection.id,
        error: kerr,
      }),
      message,
    );
    this.entryPoint.removeConnection(message.connection.id);

    if (response.aborted) {
      return;
    }

    response.cork(() => {
      response.writeStatus(Buffer.from(kerr.status.toString()));

      for (const header of this.httpConfig.headers) {
        response.writeHeader(header[0], header[1]);
      }

      // Access-Control-Allow-Origin Logic
      if (message.headers?.origin) {
        if (global.kuzzle.config.internal.allowAllOrigins) {
          response.writeHeader(
            HTTP_HEADER_ACCESS_CONTROL_ALLOW_ORIGIN,
            WILDCARD,
          );
        } else {
          response.writeHeader(
            HTTP_HEADER_ACCESS_CONTROL_ALLOW_ORIGIN,
            Buffer.from(message.headers.origin),
          );
          response.writeHeader(HTTP_HEADER_VARY, ORIGIN);
        }
      }

      response.end(content);
    });
  }

  /**
   * Convert a Kuzzle query result into an appropriate payload format
   * to send back to the client
   *
   * @param {Request} request
   * @param {HttpMessage} message
   * @returns {Buffer}
   */
  httpRequestToResponse(request: Request, message: HttpMessage): Buffer {
    const data = removeStacktrace(request.response.toJSON());

    if (message.requestId !== data.requestId) {
      data.requestId = message.requestId;

      if (!data.raw) {
        data.content.requestId = message.requestId;
      }
    }

    debugHTTP("HTTP request response: %a", data);

    // Early returns rather than reassigning `data` from the response object to
    // a string or a Buffer: the variable changed type under itself, which is
    // what the conversion could not express. Each branch is the original one.
    if (!data.raw) {
      let indent = 0;
      // `url.parse` is legacy, but `message.url` is a path with no origin, so
      // the WHATWG parser needs a base, and it throws where this one tolerates
      // a malformed URL. Swapping them changes what a bad request does, which
      // is not a decision the conversion gets to make.
      const parsedUrl = url.parse(message.url, true); // NOSONAR

      if (parsedUrl.query?.pretty !== undefined) {
        indent = 2;
      }

      return Buffer.from(JSON.stringify(data.content, undefined, indent));
    }

    const content = data.content;

    if (content === null || content === undefined) {
      return Buffer.from("");
    }

    if (typeof content !== "object") {
      // scalars are sent as strings
      return Buffer.from(content.toString());
    }

    /*
     This object can be either a Buffer object, a stringified Buffer object,
     or anything else.
     In the former two cases, we create a new Buffer object, and in the
     latter, we stringify the content.
     */
    if (content instanceof Buffer) {
      return Buffer.from(content);
    }

    if (content.type === "Buffer" && Array.isArray(content.data)) {
      // `Buffer.from(content)` and `Buffer.from(content.data)` build the same
      // bytes for the JSON form of a Buffer; the latter is the one that types.
      return Buffer.from(content.data);
    }

    return Buffer.from(JSON.stringify(content));
  }

  /**
   * Compress an outgoing message according to the
   * specified accept-encoding HTTP header
   *
   * @param  {HttpMessage} message
   * @param  {Buffer} data
   * @param  {Function} callback
   */
  httpCompress(
    message: HttpMessage,
    data: Buffer,
    callback: (result: { compressed: Buffer; encoding: string }) => void,
  ): void {
    if (message.headers["accept-encoding"]) {
      const encodings = message.headers["accept-encoding"]
        .split(",")
        .map((e) => e.trim().toLowerCase());

      // Undefined until a gzip or deflate encoding is seen: the list may hold
      // neither, which is the `identity` answer at the bottom of the method.
      let algorithm: string | undefined;
      let priority = -1;

      for (const encoding of encodings) {
        if (encoding.startsWith("gzip") || encoding.startsWith("deflate")) {
          const [_algorithm, rawPriority = "q=0"] = encoding.split(";");
          // `|| 0` was a number falling into `parseFloat`, which stringifies it
          // back; `"0"` is the same value without the round trip.
          const _priority = Number.parseFloat(rawPriority.split("=")[1] || "0");

          if (_priority > priority) {
            algorithm = _algorithm;
            priority = _priority;
          }
          // gzip should be the preferred algorithm in case of a tie
          else if (
            Math.abs(priority - _priority) < 10e-3 &&
            _algorithm === "gzip"
          ) {
            algorithm = "gzip";
          }
        }
      }

      if (algorithm === "gzip") {
        zlib.gzip(data, (err, compressed) =>
          callback({
            compressed: !err ? compressed : data,
            encoding: !err ? "gzip" : "identity",
          }),
        );
        return;
      } else if (algorithm === "deflate") {
        zlib.deflate(data, (err, compressed) =>
          callback({
            compressed: !err ? compressed : data,
            encoding: !err ? "deflate" : "identity",
          }),
        );
        return;
      }
    }

    callback({
      compressed: data,
      encoding: "identity",
    });
  }

  httpUncompress(
    message: HttpMessage,
    payload: Buffer,
    cb: (error?: Error | null, result?: Buffer) => void,
  ): void {
    const header = message.headers["content-encoding"];
    if (!header) {
      cb(null, payload);
      return;
    }

    // A separate name for the list: the JavaScript reassigned the header string
    // to the array parsed out of it.
    const encodings = header.split(",").map((e) => e.trim().toLowerCase());

    if (encodings.length > this.httpConfig.opts.maxEncodingLayers) {
      cb(kerrorHTTP.get("too_many_encodings"));
      return;
    }

    // encodings are listed in the same order they have been applied
    // this means that we need to invert the list to correctly
    // decode the message
    encodings.reverse();

    this.httpUncompressStep(encodings, payload, cb, 0);
  }

  httpUncompressStep(
    encodings: string[],
    payload: Buffer,
    cb: (error?: Error | null, result?: Buffer) => void,
    index: number,
  ): void {
    if (index === encodings.length) {
      cb(null, payload);
      return;
    }

    const encoding = encodings[index];

    if (encoding === "identity") {
      this.httpUncompressStep(encodings, payload, cb, index + 1);
    } else if (encoding === "gzip" || encoding === "deflate") {
      const fn = encoding === "gzip" ? zlib.gunzip : zlib.inflate;

      fn(payload, (err, inflated) => {
        if (err) {
          cb(err);
          return;
        }

        this.httpUncompressStep(encodings, inflated, cb, index + 1);
      });
    } else {
      cb(kerrorHTTP.get("unsupported_compression", encoding));
    }
  }

  parseWebSocketOptions(): JSONObject {
    const cfg = this.config.websocket;

    if (cfg === undefined) {
      this.logger.warn(
        "[websocket] no configuration found for websocket: disabling it",
      );
      return { enabled: false };
    }

    let idleTimeout = cfg.idleTimeout;
    const compression = cfg.compression ? uWS.SHARED_COMPRESSOR : uWS.DISABLED;

    if (idleTimeout === 0 || idleTimeout < 1000) {
      idleTimeout = DEFAULT_IDLE_TIMEOUT;
      this.logger.warn(
        `[websocket] The "idleTimeout" parameter can neither be deactivated or be set with a value lower than 1000. Defaulted to ${DEFAULT_IDLE_TIMEOUT}.`,
      );
    }

    const idleTimeoutInSecond = Math.round(idleTimeout / 1000);

    /**
     * @deprecated -- to be removed in the next major version
     */
    if (cfg.heartbeat) {
      this.logger.warn(
        '[websocket] The "heartbeat" parameter has been deprecated and is now ignored. The "idleTimeout" parameter should now be configured instead.',
      );
    }

    return {
      enabled: cfg.enabled,
      opts: {
        compression,
        idleTimeout: idleTimeoutInSecond,
        maxPayloadLength: this.maxRequestSize,
        resetIdleTimeoutOnSend: cfg.resetIdleTimeoutOnSend,
        sendPingsAutomatically: cfg.sendPingsAutomatically,
      },
      rateLimit: cfg.rateLimit,
    };
  }

  parseHttpOptions(): JSONObject {
    const cfg = this.config.http;

    if (cfg === undefined) {
      this.logger.warn("[http] no configuration found for http: disabling it");
      return { enabled: false };
    }

    // precomputes default headers
    const httpCfg = global.kuzzle.config.http;
    // uWS writes Buffers, and the raw name is kept in a third slot for the
    // lookup that follows. Built as that triplet rather than rewritten into
    // one in place: the loop read back the slots it was overwriting, so every
    // row was `string | Buffer | undefined` to the compiler and the widened
    // element type was the only thing holding the shape together.
    const rawHeaders: [string, string][] = [
      ["Access-Control-Allow-Headers", httpCfg.accessControlAllowHeaders],
      ["Access-Control-Allow-Methods", httpCfg.accessControlAllowMethods],
      ["Content-Type", "application/json"],
    ];
    const headers: [Buffer, Buffer, string][] = rawHeaders.map(
      ([name, value]) => [Buffer.from(name), Buffer.from(value), name],
    );

    return {
      enabled: cfg.enabled,
      headers,
      opts: {
        allowCompression: cfg.allowCompression,
        allowedContentTypes: [
          ...HTTP_ALLOWED_CONTENT_TYPES,
          ...cfg.additionalContentTypes,
        ],
        maxEncodingLayers: cfg.maxEncodingLayers,
        maxFormFileSize: cfg.maxFormFileSize,
      },
    };
  }
}

/**
 * Returns the list of IP addresses
 *
 * @param {uWS.HttpResponse} response
 * @param {uWS.HttpRequest} request
 * @return {Array.<string>}
 */
/**
 * Collects a uWS request's headers, which are only reachable through `forEach`.
 */
function getRequestHeaders(request: uWS.HttpRequest): Record<string, string> {
  const headers: Record<string, string> = {};

  request.forEach((name, value) => (headers[name] = value));

  return headers;
}

function getHttpIps(
  response: uWS.HttpResponse,
  request: uWS.HttpRequest,
): string[] {
  const ips = [Buffer.from(response.getRemoteAddressAsText()).toString()];

  const forwardHeader = request.getHeader("x-forwarded-for");

  if (forwardHeader && forwardHeader.length > 0) {
    for (const header of forwardHeader.split(",")) {
      const trimmed = header.trim();

      if (trimmed.length > 0) {
        ips.push(trimmed);
      }
    }
  }

  return ips;
}

export = HttpWsProtocol;
