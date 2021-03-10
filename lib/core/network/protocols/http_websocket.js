/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

'use strict';

const assert = require('assert');
const uWS = require('uWebSockets.js');

const { Request } = require('../../../api/request');
const { KuzzleError } = require('../../../kerror/errors');
const Protocol = require('./protocol');
const ClientConnection = require('../clientConnection');
const removeErrorStack = require('../removeErrorStack');
const bytes = require('../../../util/bytes');
const debug = require('../../../util/debug');
const kerror = require('../../../kerror');

const kerrorWS = kerror.wrap('network', 'websocket');
const kerrorHTTP = kerror.wrap('network', 'http');
const debugWS = debug('kuzzle:network:protocols:websocket');
const debugHTTP = debug('kuzzle:network:protocols:http');

// The idleTimeout option should never be deactivated, so instead we use
// a default value for backward-compatibility
const DEFAULT_IDLE_TIMEOUT = 60000;

// Size of backpressure an individual socket can handle before needing to drain
const WS_MAX_BACKPRESSURE = 4096;

// Size of the backpressure buffer: if a client is too slow to absorb the amount
// of data we need to send to it, then we forcibly close its socket to prevent
// the server to be impacted by it
const WS_BACKPRESSURE_BUFFER_MAX_LENGTH = 50;

// Applicative WebSocket PONG message for browsers
const APPLICATIVE_PONG_MESSAGE = Buffer.from('{"p":2}');

// Used by the broadcast method to build JSON payloads while limiting the
// number of JSON serializations
const JSON_ROOM_PROPERTY = ',"room":"';
const JSON_ENDER = '"}';

// pre-computed error messages
const TOO_MUCH_BACKPRESSURE_MESSAGE = Buffer.from('too much backpressure: client is too slow');
const GENERIC_CLOSE_MESSAGE = Buffer.from('Connection closed by remote host');

// HTTP-related constants
const ALLOWED_JSON_CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
];
const HTTP_ALLOWED_HEADERS = [
  'Content-Type',
  'Access-Control-Allow-Headers',
  'Authorization',
  'X-Requested-With',
  'Content-Length',
  'Content-Encoding',
  'X-Kuzzle-Volatile'
].join(',');

const CHARSET_REGEX = /charset=([\w-]+)/i;

/**
 * @class HttpMessage
 */
class HttpMessage {
  /**
   * @param {ClientConnection} connection
   * @param {uWS.HttpRequest} request
   */
  constructor(connection, request) {
    this.connection = connection;
    this.raw = null;
    this.json = null;
    this.ips = connection.ips;
    this.requestId = connection.id;
    // @deprecated use "path" instead
    this.url = request.getUrl();
    this.path = this.url;
    this.method = request.getMethod();
    this.headers = {};

    request.forEach((name, value) => (this.headers[name] = value));
  }

  addChunk (chunk) {
    if (this.raw === null) {
      this.raw = chunk;
    }
    else {
      this.raw += chunk;
    }
  }

  /**
   * Checks that an incoming HTTP message is well-formed
   *
   */
  validate () {
    if (this.isEmpty()) {
      return;
    }

    const contentType = this.headers['content-type'];

    if ( contentType
      && !ALLOWED_JSON_CONTENT_TYPES.some(allowed => contentType.includes(allowed))
    ) {
      throw kerrorHTTP.get('unsupported_content', contentType);
    }

    const encoding = CHARSET_REGEX.exec(contentType);

    if (encoding !== null && encoding[1].toLowerCase() !== 'utf-8') {
      throw kerrorHTTP.get('unsupported_charset', encoding[1].toLowerCase());
    }
  }

  get content () {
    this.validate();

    if (this.json === null && this.raw !== null) {
      try {
        this.json = JSON.parse(this.raw);
      }
      catch (e) {
        throw kerrorHTTP.get('body_parse_failed');
      }
    }

    return this.json;
  }

  isEmpty () {
    return this.json === null && this.raw === null;
  }
}

/**
 * @class HTTPWS
 * Handles both HTTP and WebSocket connections
 */
class HTTPWS extends Protocol {
  constructor () {
    super('websocket');

    this.server = null;
    this.wsConfig = null;
    this.httpConfig = null;

    // Used to limit the rate of messages on websocket
    this.now = Date.now();
    this.nowInterval = setInterval(() => {
      this.activityTimestamp = Date.now();
    }, 1000);

    // Map<uWS.WebSocket, ClientConnection>
    this.connectionBySocket = new Map();

    // Map<uWS.WebSocket, Array.<Buffer>>
    this.backpressureBuffer = new Map();

    // Map<string, uWS.WebSocket>
    this.socketByConnectionId = new Map();
  }

  async init (entrypoint) {
    super.init(null, entrypoint);

    this.config = entrypoint.config.protocols;

    this.wsConfig = this.parseWebSocketOptions();
    this.httpConfig = this.parseHttpOptions();

    if (!this.wsConfig.enabled && !this.httpConfig.enabled) {
      return false;
    }

    // eslint-disable-next-line new-cap
    this.server = uWS.App();

    if (this.wsConfig.enabled) {
      this.initWebSocket();
    }

    if (this.httpConfig.enabled) {
      this.initHttp();
    }

    this.server.listen(entrypoint.config.port, socket => {
      if (!socket) {
        throw new Error(`[http/websocket] fatal: unable to listen to port ${entrypoint.config.port}`);
      }
    });

    return true;
  }

  initWebSocket () {
    /* eslint-disable sort-keys */
    this.server.ws('/*', {
      ...this.wsConfig.opts,
      maxBackPressure: WS_MAX_BACKPRESSURE,
      open: this.wsOnOpenHandler.bind(this),
      close: this.wsOnCloseHandler.bind(this),
      message: this.wsOnMessageHandler.bind(this),
      drain: this.wsOnDrainHandler.bind(this),
    });
    /* eslint-enable sort-keys */
  }

  initHttp () {
    this.server.any('/*', this.httpOnMessageHandler.bind(this));
  }

  broadcast (data) {
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

      // prevent buffer overwrites due to socket.send being an
      // async method (race condition)
      const payloadLength = offset + channel.length + JSON_ENDER.length;
      const payloadSafeCopy = Buffer.allocUnsafe(payloadLength);

      payload.copy(payloadSafeCopy, 0, 0, payloadLength);

      debugWS('Publishing to channel "realtime/%s": %s', channel, payloadSafeCopy);
      this.server.publish(`realtime/${channel}`, payloadSafeCopy, false);
    }
  }

  notify (data) {
    const socket = this.socketByConnectionId.get(data.connectionId);
    debugWS('notify: %a', data);

    if (!socket) {
      return;
    }

    const payload = data.payload;


    for (let i = 0; i < data.channels.length; i++) {
      payload.room = data.channels[i];
      this.wsSend(socket, Buffer.from(JSON.stringify(payload)));
    }
  }

  joinChannel (channel, connectionId) {
    debugWS('joinChannel: %s %s', channel, connectionId);

    const socket = this.socketByConnectionId.get(connectionId);

    if (!socket) {
      return;
    }

    debugWS('Subscribing connection ID "%s" to channel "realtime/%s"', connectionId, channel);
    socket.subscribe(`realtime/${channel}`);
  }

  leaveChannel (channel, connectionId) {
    debugWS('leaveChannel: %s %s', channel, connectionId);

    const socket = this.socketByConnectionId.get(connectionId);

    if (!socket) {
      return;
    }

    socket.unsubscribe(`realtime/${channel}`);
  }

  disconnect (connectionId, message = null) {
    debug('[%s] forced disconnect', connectionId);

    const socket = this.socketByConnectionId.get(connectionId);

    if (!socket) {
      return;
    }

    socket.end(1011, message ? Buffer.from(message) : GENERIC_CLOSE_MESSAGE);
  }

  wsOnOpenHandler (socket) {
    const ip = Buffer.from(socket.getRemoteAddressAsText()).toString();
    const connection = new ClientConnection(this.name, [ip]);

    this.entryPoint.newConnection(connection);
    this.connectionBySocket.set(socket, connection);
    this.socketByConnectionId.set(connection.id, socket);
    this.backpressureBuffer.set(socket, []);
  }

  wsOnCloseHandler (socket, code, message) {
    const connection = this.connectionBySocket.get(socket);

    if (!connection) {
      return;
    }

    if (debugWS.enabled) {
      debugWS(
        '[%s] received a `close` event (CODE: %d, REASON: %s)',
        connection.id,
        code,
        Buffer.from(message).toString());
    }
    this.entryPoint.removeConnection(connection.id);
    this.connectionBySocket.delete(socket);
    this.backpressureBuffer.delete(socket);
    this.socketByConnectionId.delete(connection.id);
  }

  wsOnMessageHandler (socket, data) {
    const connection = this.connectionBySocket.get(socket);

    if (!data || !connection) {
      return;
    }

    // enforce rate limits
    if (this.wsConfig.rateLimit > 0) {
      if (socket.last === this.now) {
        socket.count++;

        if (socket.count > this.wsConfig.rateLimit) {
          this.wsSendError(socket, connection, kerrorWS.get('ratelimit_exceeded'));
          return;
        }
      }
      else {
        socket.last = this.now;
        socket.count = 1;
      }
    }

    let parsed;
    const message = Buffer.from(data).toString();

    debugWS('[%s] client message: %s', connection.id, message);

    try {
      parsed = JSON.parse(message);
    }
    catch (e) {
      /*
       we cannot add a "room" information since we need to extract
       a request ID from the incoming data, which is apparently
       not a valid JSON
       So... the error is forwarded to the client, hoping they know
       what to do with it.
       */
      this.wsSendError(
        socket,
        connection,
        kerrorWS.getFrom(e, 'unexpected_error', e.message));
      return;
    }

    if (parsed.p && parsed.p === 1 && Object.keys(parsed).length === 1) {
      debugWS('[%s] sending back a "pong" message', connection.id);
      this.wsSend(socket, APPLICATIVE_PONG_MESSAGE);
      return;
    }

    try {
      this.entryPoint.execute(new Request(parsed, { connection }), result => {
        if (result.content && typeof result.content === 'object') {
          result.content.room = result.requestId;
        }
        this.wsSend(socket, Buffer.from(JSON.stringify(result.content)));
      });
    }
    catch (e) {
      const errobj = {
        error: {
          message: e.message
        },
        room: parsed.requestId,
        status: 400
      };

      this.wsSend(socket, Buffer.from(JSON.stringify(errobj)));
    }
  }

  /**
   * Absorb as much of the backpressure buffer as possible
   * @param  {uWS.WebSocket} socket
   */
  wsOnDrainHandler (socket) {
    socket.cork(() => {
      const buffer = this.backpressureBuffer.get(socket);

      while (buffer.length > 0
        && socket.getBufferedAmount() < WS_MAX_BACKPRESSURE
      ) {
        const payload = buffer.shift();
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
   */
  wsSendError (socket, connection, error) {
    const request = new Request({}, { connection, error });
    const sanitized = removeErrorStack(request.response.toJSON()).content;

    this.wsSend(socket, Buffer.from(JSON.stringify(sanitized)));
  }

  /**
   * Sends a message immediately, or queue it up for later if backpressure built
   * up
   *
   * @param  {uWS.WebSocket} socket
   * @param  {Buffer} payload
   */
  wsSend (socket, payload) {
    if (!this.connectionBySocket.has(socket)) {
      return;
    }

    if (socket.getBufferedAmount() < WS_MAX_BACKPRESSURE) {
      socket.cork(() => socket.send(payload));
    }
    else {
      const buffer = this.backpressureBuffer.get(socket);
      buffer.push(payload);

      // Client socket too slow: we need to close it
      if (buffer.length > WS_BACKPRESSURE_BUFFER_MAX_LENGTH) {
        socket.end(1011, TOO_MUCH_BACKPRESSURE_MESSAGE);
      }
    }
  }

  /**
   * @param  {uWS.HttpResponse} response
   * @param  {uWS.HttpRequest} request
   */
  httpOnMessageHandler (response, request) {
    const connection = new ClientConnection(
      'HTTP/1.1',
      getHttpIps(response, request),
      request.headers);
    const message = new HttpMessage(connection, request);

    debug('[%s] Received HTTP request: %a', connection.id, message);

    this.entryPoint.newConnection(connection);

    if (message.headers['content-length'] > this.maxRequestSize) {
      request.resume();
      this._replyWithError(
        message,
        response,
        kerror.get('request_too_large'));
      return;
    }

    let stream, pipes;

    try {
      stream = this._createWritableStream(request, message);
      pipes = this._uncompress(request);
    } catch(err) {
      request.resume();
      this._replyWithError(message, response, err);
      return;
    }

    // We attach our writable stream to the last pipe of the chain
    if (pipes.length > 0) {
      pipes[pipes.length-1].pipe(stream);
    } else {
      request.pipe(stream);
    }

    // We forwarded all pipe errors to the request's event handler
    request.on('error', err => {
      const kerr = err instanceof KuzzleError
        ? err
        : kerror.getFrom(err, 'unexpected_error', err.message);
      // remove all pipes before flushing the stream
      request.unpipe();
      request.removeAllListeners().resume();
      stream.removeAllListeners().end();

      // When an error occurs on a Readable Stream, the
      // registered pipes are NOT freed automatically
      pipes.forEach(pipe => pipe.close());

      this._replyWithError(message, response, kerr);
    });

    stream.on('finish', () => {
      debug('[%s] End Request', connection.id);
      this._sendRequest(connection, response, message);
    });
  }

  /**
   * Forward an error response to the client
   *
   * @param {HttpMessage} message
   * @param {uWS.HttpResponse} response
   * @param {Error} error
   */
  httpSendError (message, response, error) {
    const kerr = error instanceof KuzzleError
      ? error
      : kerrorHTTP.getFrom(error, 'unexpected_error', error.message);

    const result = {
      content: JSON.stringify(removeErrorStack(kerr)),
      raw: true
    };

    debugHTTP('[%s] replyWithError: %a', message.connection.id, kerr);

    this.entryPoint.logAccess(
      new Request(message, {
        connectionId: message.connection.id,
        error: kerr,
      }),
      message);

    response.writeHead(kerr.status, {
      'Access-Control-Allow-Headers': HTTP_ALLOWED_HEADERS,
      'Access-Control-Allow-Methods': HTTP_ALLOWED_METHODS,
      'Access-Control-Allow-Origin': '*',
      'Content-Length': String(result.content.length),
      'Content-Type': 'application/json'
    });

    response.end(result.content);

    this.entryPoint.removeConnection(message.connection.id);
  }

  parseWebSocketOptions () {
    const cfg = this.config.websocket;

    if (cfg === undefined) {
      global.kuzzle.log.warn('[websocket] no configuration found for websocket: disabling it');
      return { enabled: false };
    }

    assert(typeof cfg.enabled === 'boolean', `[websocket] "enabled" parameter: invalid value "${cfg.enabled}" (boolean expected)`);
    assert(Number.isInteger(cfg.idleTimeout) && cfg.idleTimeout >= 0, `[websocket] "idleTimeout" parameter: invalid value "${cfg.idleTimout}" (integer >= 1000 expected)`);
    assert(Number.isInteger(cfg.rateLimit) && cfg.rateLimit >= 0, `[websocket] "rateLimit" parameter: invalid value "${cfg.rateLimit}" (integer >= 0 expected)`);
    assert(typeof cfg.compression === 'boolean', `[websocket] "compression" parameter: invalid value "${cfg.compression}" (boolean value expected)`);

    let idleTimeout = cfg.idleTimeout;
    const compression = cfg.compression ? uWS.SHARED_COMPRESSOR : uWS.DISABLED;

    if (idleTimeout === 0 || idleTimeout < 1000) {
      idleTimeout = DEFAULT_IDLE_TIMEOUT;
      global.kuzzle.log.warn(`[websocket] The "idleTimeout" parameter cannot be deactivated or be set with a value lower than 1000. Defaulted to ${DEFAULT_IDLE_TIMEOUT}.`);
    }

    if (this.config.websocket.heartbeat) {
      global.kuzzle.log.warn('[websocket] The "heartbeat" parameter has been deprecated and is now ignored. The "idleTimeout" parameter should now be configured instead.');
    }

    return {
      enabled: cfg.enabled,
      opts: {
        compression,
        idleTimeout,
        maxPayloadLength: this.maxRequestSize,
      },
      rateLimit: cfg.rateLimit,
    };
  }

  parseHttpOptions () {
    const cfg = this.config.http;

    assert(typeof cfg.enabled === 'boolean', `[http] "enabled" parameter: invalid value "${cfg.enabled}" (boolean expected)`);

    const maxFormFileSize = bytes(cfg.maxFormFileSize);

    assert(Number.isInteger(maxFormFileSize), `[http] "maxFormFileSize" parameter: cannot parse "${cfg.maxFormFileSize}"`);

    // precomputes default headers
    const httpCfg = global.kuzzle.config.http;
    const headers = [
      [ 'Access-Control-Allow-Headers', httpCfg.accessControlAllowHeaders ],
      [ 'Access-Control-Allow-Methods', httpCfg.accessControlAllowMethods ],
      [ 'Access-Control-Allow-Origin', httpCfg.accessControlAllowOrigin ],
      [ 'Content-Type', 'application/json' ],
    ];

    for (const header of headers) {
      header[0] = Buffer.from(header[0]);
      header[1] = Buffer.from(header[1]);
    }

    return {
      enabled: cfg.enabled,
      headers,
      opts: {
        maxFormFileSize,
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
function getHttpIps (response, request) {
  const ips = [Buffer.from(response.getRemoteAddressAsText()).toString()];

  const forwardHeader = request.getHeader('x-forwarded-for');

  if (forwardHeader && forwardHeader.length > 0) {
    for (const header of forwardHeader.split(',')) {
      const trimmed = header.trim();

      if (trimmed.length > 0) {
        ips.push(trimmed);
      }
    }
  }

  return ips;
}

module.exports = HTTPWS;
