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
  assert = require('assert'),
  debug = require('../../../../../kuzzleDebug')('kuzzle:entry-point:protocols:http'),
  bytes = require('bytes'),
  url = require('url'),
  ClientConnection = require('../clientConnection'),
  Protocol = require('./protocol'),
  { Writable } = require('stream'),
  HttpFormDataStream = require('../service/httpFormDataStream'),
  {
    Request,
    errors: {
      KuzzleError,
      BadRequestError,
      SizeLimitError
    }
  } = require('kuzzle-common-objects'),
  zlib = require('zlib');

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
 * @class HttpProtocol
 */
class HttpProtocol extends Protocol {
  constructor() {
    super();

    this.maxFormFileSize = 0;
    this.server = null;
    this.maxEncodingLayers = 0;
    this.decoders = {};
  }

  /**
   * Initialize the HTTP server
   *
   * @param {EmbeddedEntryPoint} entryPoint
   */
  init(entryPoint) {
    return super.init('http', entryPoint)
      .then(() => {
        const config = entryPoint.config.protocols.http;

        if (config.enabled === false) {
          return false;
        }

        debug('initializing http Server with config: %a', entryPoint.config);

        this.maxFormFileSize = bytes.parse(config.maxFormFileSize);
        this.maxEncodingLayers = config.maxEncodingLayers;
        this.server = entryPoint.httpServer;

        for (const value of ['maxFormFileSize', 'maxEncodingLayers']) {
          assert(
            Number.isInteger(this[value]),
            `Invalid HTTP "${value}" parameter value: expected a numeric value`);
        }

        this.decoders = this._setDecoders();

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
      // emulates a request coming from the (deprecated) Kuzzle Proxy server
      proxyRequest = {
        ips,
        requestId: connection.id,
        url: request.url,
        method: request.method,
        headers: request.headers,
        content: ''
      };

    debug('[%s] receiving HTTP request: %a', connection.id, proxyRequest);
    this.entryPoint.newConnection(connection);

    if (request.headers['content-length'] > this.maxRequestSize) {
      request.resume();
      this._replyWithError(
        connection,
        proxyRequest,
        response,
        new SizeLimitError('Maximum HTTP request size exceeded'));
      return;
    }

    let stream, pipes;

    try {
      stream = this._createWritableStream(request, proxyRequest);
      pipes = this._uncompress(request);
    } catch(err) {
      request.resume();
      this._replyWithError(connection, proxyRequest, response, err);
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
      const kerr = err instanceof KuzzleError ? err : new BadRequestError(err);
      // remove all pipes before flushing the stream
      request.unpipe();
      request.removeAllListeners().resume();
      stream.removeAllListeners().end();

      // When an error occurs on a Readable Stream, the
      // registered pipes are NOT freed automatically
      pipes.forEach(pipe => pipe.close());

      this._replyWithError(connection, proxyRequest, response, kerr);
    });

    stream.on('finish', () => {
      debug('[%s] End Request', connection.id);
      proxyRequest.headers['content-type'] = 'application/json';
      this._sendRequest(connection, response, proxyRequest);
    });
  }

  /**
   * Send a request to Kuzzle and forwards the response back to the client
   *
   * @param {ClientConnection} connection
   * @param {http.ServerResponse} response
   * @param {Object} proxyRequest
   */
  _sendRequest (connection, response, proxyRequest) {
    debug('[%s] sendRequest: %a', connection.id, proxyRequest);

    if (proxyRequest.json) {
      proxyRequest.content = JSON.stringify(proxyRequest.json);
    }

    this.entryPoint.kuzzle.router.http.route(proxyRequest, request => {
      this.entryPoint.logAccess(request, proxyRequest);

      const data = this._getResponseData(request, proxyRequest);

      this._compress(data, response, proxyRequest.headers, (err, deflated) => {
        if (err) {
          const kuzerr = err instanceof KuzzleError ?
            err : new BadRequestError(err);
          this._replyWithError(connection, proxyRequest, response, kuzerr);
          return;
        }

        response.writeHead(request.response.status, request.response.headers);
        response.end(deflated);

        this.entryPoint.removeConnection(connection.id);
      });
    });
  }

  /**
   * Forward an error response to the client
   *
   * @param {ClientConnection} connection
   * @param {Object} proxyRequest
   * @param {http.ServerResponse} response
   * @param {Error} error
   */
  _replyWithError(connection, proxyRequest, response, error) {
    const result = {
      raw: true,
      content: JSON.stringify(error)
    };

    debug('[%s] replyWithError: %a', connection.id, error);

    this.entryPoint.logAccess(
      new Request(proxyRequest, {error, connectionId: connection.id}),
      proxyRequest);

    response.writeHead(error.status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': defaultAllowedMethods,
      'Access-Control-Allow-Headers': defaultAllowedHeaders
    });

    response.end(result.content);

    this.entryPoint.removeConnection(connection.id);
  }

  /**
   * Convert a Kuzzle query result into an appropriate payload format
   * to send back to the client
   *
   * @param {Request} request
   * @param {Object} proxyRequest
   * @return {Buffer}
   */
  _getResponseData(request, proxyRequest) {
    let data = request.response.toJSON();

    if (proxyRequest.requestId !== data.requestId) {
      data.requestId = proxyRequest.requestId;

      if (!data.raw) {
        data.content.requestId = proxyRequest.requestId;
      }
    }

    debug('HTTP request response: %a', data);

    if (data.raw) {
      if (typeof data.content === 'object') {
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
        }
        else {
          data = JSON.stringify(data.content);
        }
      }
      else {
        // scalars are sent as-is
        data = data.content;
      }
    } else {
      let indent = 0;
      const parsedUrl = url.parse(proxyRequest.url, true);

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
        throw new BadRequestError('Too many encodings');
      }

      for (const encoding of encodings) {
        let pipe;

        if (this.decoders[encoding]) {
          pipe = this.decoders[encoding]();
        } else {
          request.removeAllListeners().resume();
          throw new BadRequestError(`Unsupported compression algorithm "${encoding}"`);
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
   * @param  {Object} proxyRequest
   * @return {stream.Writable}
   */
  _createWritableStream(request, proxyRequest) {
    if (request.headers['content-type'] &&
      !request.headers['content-type'].startsWith('application/json')
    ) {
      return new HttpFormDataStream(
        {
          headers: request.headers,
          limits: { fileSize: this.maxFormFileSize }
        },
        proxyRequest,
        request);
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
          callback(new SizeLimitError('Maximum HTTP request size exceeded'));
          return;
        }

        proxyRequest.content += chunk.toString();
        callback();
      }
    });
  }

  /**
   * Initialize the decoders property according to the current
   * server configuration
   * @return {Objet} A set of all supported decoders
   */
  _setDecoders() {
    const
      allowCompression = this.entryPoint.config.protocols.http.allowCompression,
      disabledfn = () => {
        throw new BadRequestError('Compression support is disabled');
      };

    assert(
      typeof allowCompression === 'boolean',
      'Invalid HTTP "allowCompression" parameter value: expected a boolean value');

    // for now, we accept gzip, deflate and identity
    const decoders = {};

    decoders.gzip = allowCompression ? zlib.createGunzip : disabledfn;
    decoders.deflate = allowCompression ? zlib.createInflate : disabledfn;
    decoders.identity = () => null;

    return decoders;
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
      } else if (allowedEncodings.has('deflate')) {
        response.setHeader('Content-Encoding', 'deflate');
        return zlib.deflate(data, callback);
      }
    }

    callback(null, data);
  }
}

module.exports = HttpProtocol;
