/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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

const
  errorsManager = require('../../../util/errors').wrap('network', 'http'),
  assert = require('assert'),
  debug = require('../../../util/debug')('kuzzle:entry-point:protocols:http'),
  bytes = require('bytes'),
  url = require('url'),
  ClientConnection = require('../clientConnection'),
  Protocol = require('./protocol'),
  { Writable } = require('stream'),
  HttpFormDataStream = require('../service/httpFormDataStream'),
  {
    Request,
    errors: { KuzzleError }
  } = require('kuzzle-common-objects'),
  zlib = require('zlib'),
  removeErrorStack = require('../removeErrorStack');

const
  defaultAllowedMethods = 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS',
  defaultAllowedHeaders = [
    'Content-Type',
    'Access-Control-Allow-Headers',
    'Authorization',
    'X-Requested-With',
    'Content-Length',
    'Content-Encoding',
    'X-Kuzzle-Volatile'
  ].join(',');

/**
 * @class HttpMessage
 */
class HttpMessage {
  /**
   * @param {ClientConnection} connection
   * @param {http.IncomingMessage} request
   */
  constructor(connection, request) {
    this.connection = connection;
    this.raw = null;
    this.json = null;
    this.ips = connection.ips;
    this.requestId = connection.id;
    this.url = request.url;
    this.method = request.method;
    this.headers = Object.assign({}, request.headers);
  }

  addChunk (chunk) {
    if (this.raw === null) {
      this.raw = chunk;
    }
    else {
      this.raw += chunk;
    }
  }

  get content () {
    if (this.json === null && this.raw !== null) {
      try {
        this.json = JSON.parse(this.raw);
      }
      catch (e) {
        errorsManager.throw('body_parse_failed');
      }
    }

    return this.json;
  }

  isEmpty () {
    return this.json === null && this.raw === null;
  }
}

/**
 * @class HttpProtocol
 */
class HttpProtocol extends Protocol {
  constructor() {
    super();

    this.maxFormFileSize = 0;
    this.server = null;
    this.maxEncodingLayers = 0;
    this.decoders = new Map();
  }

  /**
   * Initialize the HTTP server
   *
   * @param {EmbeddedEntryPoint} entryPoint
   */
  init(entryPoint) {
    return super.init('http', entryPoint)
      .then(() => {
        if (this.config.enabled === false) {
          return false;
        }

        debug('initializing http Server with config: %a', this.config);

        this.maxFormFileSize = bytes.parse(this.config.maxFormFileSize);
        this.maxEncodingLayers = this.config.maxEncodingLayers;
        this.server = entryPoint.httpServer;

        for (const value of ['maxFormFileSize', 'maxEncodingLayers']) {
          assert(
            Number.isInteger(this[value]),
            `Invalid HTTP "${value}" parameter value: expected a numeric value`);
        }

        this._setDecoders();

        this.server.on('request', this.onMessage.bind(this));

        return true;
      });
  }

  /**
   * Invoked whenever a HTTP request is received
   *
   * @param  {http.IncomingMessage} request
   * @param  {http.ServerResponse} response
   */
  onMessage(request, response) {
    const
      ips = this._getIps(request),
      connection = new ClientConnection(
        `HTTP/${request.httpVersion}`,
        ips,
        request.headers),
      message = new HttpMessage(connection, request);

    debug('[%s] Received HTTP request: %a', connection.id, message);

    this.entryPoint.newConnection(connection);

    if (request.headers['content-length'] > this.maxRequestSize) {
      request.resume();
      this._replyWithError(
        message,
        response,
        errorsManager.get('request_too_large'));
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
        : errorsManager.getFrom(err, 'unexpected_error', err.message);
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
   * Send a request to Kuzzle and forwards the response back to the client
   *
   * @param {ClientConnection} connection
   * @param {http.ServerResponse} response
   * @param {HttpMessage} message
   */
  _sendRequest (connection, response, message) {
    debug('[%s] sendRequest: %a', connection.id, message);

    this.entryPoint.kuzzle.router.http.route(message, request => {
      this.entryPoint.logAccess(request, message);

      const data = this._getResponseData(request, message);

      this._compress(data, response, message.headers, (err, deflated) => {
        if (err) {
          const kuzerr = err instanceof KuzzleError
            ? err
            : errorsManager.getFrom(err, 'unexpected_error', err.message);

          this._replyWithError(connection, response, kuzerr);
          return;

        }

        request.response.setHeader('Content-Length', String(deflated.length));

        response.writeHead(request.response.status, request.response.headers);
        response.end(deflated);

        this.entryPoint.removeConnection(connection.id);
      });
    });
  }

  /**
   * Forward an error response to the client
   *
   * @param {HttpMessage} message
   * @param {http.ServerResponse} response
   * @param {Error} error
   */
  _replyWithError(message, response, error) {
    const kerr = error instanceof KuzzleError
      ? error
      : errorsManager.getFrom(error, 'unexpected_error', error.message);

    const result = {
      raw: true,
      content: JSON.stringify(removeErrorStack(kerr))
    };

    debug('[%s] replyWithError: %a', message.connection.id, kerr);

    this.entryPoint.logAccess(
      new Request(message, {error: kerr, connectionId: message.connection.id}),
      message);

    response.writeHead(kerr.status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': defaultAllowedMethods,
      'Access-Control-Allow-Headers': defaultAllowedHeaders,
      'Content-Length': String(result.content.length)
    });

    response.end(result.content);

    this.entryPoint.removeConnection(message.connection.id);
  }

  /**
   * Convert a Kuzzle query result into an appropriate payload format
   * to send back to the client
   *
   * @param {Request} request
   * @param {HttpMessage} message
   * @return {Buffer}
   */
  _getResponseData(request, message) {
    let data = removeErrorStack(request.response.toJSON());

    if (message.requestId !== data.requestId) {
      data.requestId = message.requestId;

      if (!data.raw) {
        data.content.requestId = message.requestId;
      }
    }

    debug('HTTP request response: %a', data);

    if (data.raw) {
      if (data.content === null || data.content === undefined) {
        data = '';
      } else if (typeof data.content === 'object') {
        /*
         This object can be either a Buffer object, a stringified Buffer object,
         or anything else.
         In the former two cases, we create a new Buffer object, and in the
         latter, we stringify the content.
         */
        if (data.content instanceof Buffer ||
          (data.content.type === 'Buffer' && Array.isArray(data.content.data))
        ) {
          data = data.content;
        } else {
          data = JSON.stringify(data.content);
        }
      } else {
        // scalars are sent as-is
        data = data.content;
      }
    } else {
      let indent = 0;
      const parsedUrl = url.parse(message.url, true);

      if (parsedUrl.query && parsedUrl.query.pretty !== undefined) {
        indent = 2;
      }

      data = JSON.stringify(data.content, undefined, indent);
    }

    return Buffer.from(data);
  }

  /**
   * Return a new Readable Stream configured with
   * uncompression algorithms if needed
   *
   * @param  {http.IncomingMessage} request
   * @return {Array.<stream.Readable>}
   * @throws {BadRequestError} If invalid compression algorithm is set
   *                           or if the value does not comply to the
   *                           way the Kuzzle server is configured
   */
  _uncompress(request) {
    const pipes = [];

    if (request.headers['content-encoding']) {
      const encodings = request.headers['content-encoding']
        .split(',')
        .map(e => e.trim().toLowerCase());

      // encodings are listed in the same order they have been applied
      // this means that we need to invert the list to correctly
      // decode the message
      encodings.reverse();

      if (encodings.length > this.maxEncodingLayers) {
        errorsManager.throw('too_many_encodings');
      }

      for (const encoding of encodings) {
        let pipe;
        const decoder = this.decoders.get(encoding);

        if (decoder) {
          pipe = decoder();
        }
        else {
          request.removeAllListeners().resume();
          errorsManager.throw('unsupported_compression', encoding);
        }

        if (pipe) {
          const lastPipe = pipes.length > 0 ? pipes[pipes.length-1] : request;
          lastPipe.pipe(pipe);
          pipes.push(pipe);

          // forward zlib errors to the request global error handler
          pipe.on('error', error => request.emit('error', error));
        }
      }
    }

    return pipes;
  }

  /**
   * Either get a HTTP form stream, or create a new Writable stream from
   * scratch configured to receive a HTTP request
   *
   * @param  {http.IncomingMessage} request
   * @param  {HttpMessage} message
   * @return {stream.Writable}
   */
  _createWritableStream(request, message) {
    if (request.headers['content-type'] &&
      !request.headers['content-type'].startsWith('application/json')
    ) {
      try {
        return new HttpFormDataStream(
          {
            headers: request.headers,
            limits: { fileSize: this.maxFormFileSize }
          },
          message,
          request);
      }
      catch (error) {
        errorsManager.throwFrom(error, 'unexpected_error', error.message);
      }
    }

    const maxRequestSize = this.maxRequestSize; // prevent context mismatch
    let streamLength = 0;

    return new Writable({
      write(chunk, encoding, callback) {
        /*
         * The content-length header can be bypassed and
         * is not reliable enough. We have to enforce the HTTP
         * max size limit while reading the stream too
         */
        streamLength += chunk.length;

        if (streamLength > maxRequestSize) {
          callback(errorsManager.get('request_too_large'));
          return;
        }

        message.addChunk(chunk.toString());
        callback();
      }
    });
  }

  /**
   * Initialize the decoders property according to the current
   * server configuration
   */
  _setDecoders() {
    const
      allowCompression = this.config.allowCompression,
      disabledfn = () => {
        errorsManager.throw('compression_disabled');
      };

    assert(
      typeof allowCompression === 'boolean',
      'Invalid HTTP "allowCompression" parameter value: expected a boolean value');

    // for now, we accept gzip, deflate and identity
    this.decoders.set('gzip', allowCompression ? zlib.createGunzip : disabledfn);
    this.decoders.set('deflate', allowCompression ? zlib.createInflate : disabledfn);
    this.decoders.set('identity', () => null);
  }

  /**
   * Compress an outgoing message according to the
   * specified accept-encoding HTTP header
   *
   * @param  {Buffer} data     - data to compress
   * @param  {ServerResponse} response
   * @param  {Object} headers
   * @param  {Function} callback
   */
  _compress(data, response, headers, callback) {
    if (headers && headers['accept-encoding']) {
      const allowedEncodings = new Set(headers['accept-encoding']
        .split(',')
        .map(e => e.trim().toLowerCase()));

      // gzip should be preferred over deflate
      if (allowedEncodings.has('gzip')) {
        response.setHeader('Content-Encoding', 'gzip');
        return zlib.gzip(data, callback);
      }
      else if (allowedEncodings.has('deflate')) {
        response.setHeader('Content-Encoding', 'deflate');
        return zlib.deflate(data, callback);
      }
    }

    callback(null, data);
  }
}

module.exports = { HttpMessage, HttpProtocol };
