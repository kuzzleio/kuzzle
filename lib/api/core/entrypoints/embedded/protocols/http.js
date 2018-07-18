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
  debug = require('../../../../../kuzzleDebug')('kuzzle:entry-point:protocols:http'),
  bytes = require('bytes'),
  url = require('url'),
  ClientConnection = require('../clientConnection'),
  Protocol = require('./protocol'),
  Writable = require('stream').Writable,
  HttpFormDataStream = require('../service/httpFormDataStream'),
  {
    KuzzleError,
    BadRequestError,
    SizeLimitError
  } = require('kuzzle-common-objects').errors,
  Request = require('kuzzle-common-objects').Request,
  zlib = require('zlib');

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
    super.init(entryPoint);

    debug('initializing http Server with config: %a', entryPoint.config);

    this.maxFormFileSize = bytes.parse(entryPoint.config.protocols.http.maxFormFileSize);
    this.maxEncodingLayers = entryPoint.config.protocols.http.maxEncodingLayers;
    this.server = entryPoint.httpServer;

    for (const numericParameter of ['maxFormFileSize', 'maxEncodingLayers']) {
      if (this[numericParameter] === null || isNaN(this[numericParameter])) {
        throw new Error(`Invalid HTTP "${numericParameter}" parameter value: expected a numeric value`);
      }
    }

    this.decoders = this._setDecoders();

    this.server.on('request', (request, response) => {
      const ips = [request.socket.remoteAddress];

      if (request.headers['x-forwarded-for']) {
        request.headers['x-forwarded-for'].split(',').forEach(s => ips.push(s.trim()));
      }

      const
        connection = new ClientConnection('HTTP/' + request.httpVersion, ips, request.headers),
        payload = {
          ips,
          requestId: connection.id,
          url: request.url,
          method: request.method,
          headers: request.headers,
          content: ''
        };

      debug('[%s] receiving HTTP request: %a', connection.id, payload);
      this.entryPoint.newConnection(connection);

      if (request.headers['content-length'] > this.maxRequestSize) {
        request.resume();
        return this._replyWithError(connection.id, payload, response, new SizeLimitError('Maximum HTTP request size exceeded'));
      }

      let stream;

      if (!request.headers['content-type'] || request.headers['content-type'].startsWith('application/json')) {
        stream = this._createWriteStream(connection.id, payload);
      } else {
        try {
          stream = new HttpFormDataStream({
            headers: request.headers,
            limits: {fileSize: this.maxFormFileSize}
          }, payload, request);
        } catch (error) {
          request.resume();
          return this._replyWithError(connection.id, payload, response, new BadRequestError(error));
        }
      }

      let pipes;

      try {
        pipes = this._uncompress(request);
      } catch(err) {
        return this._replyWithError(connection.id, payload, response, err);
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

        return this._replyWithError(connection.id, payload, response, kerr);
      });

      stream.on('finish', () => {
        debug('[%s] End Request', connection.id);
        payload.headers['content-type'] = 'application/json';
        this._sendRequest(connection.id, response, payload);
      });
    });
  }

  /**
   * Send a request to Kuzzle and forwards the response back to the client
   *
   * @param {string} connectionId - connection Id
   * @param {ServerResponse} response
   * @param {Object} payload
   */
  _sendRequest (connectionId, response, payload) {
    debug('[%s] sendRequest: %a', connectionId, payload);

    if (payload.json) {
      payload.content = JSON.stringify(payload.json);
    }

    this.entryPoint.kuzzle.router.http.route(payload, result => {
      this.entryPoint.logAccess(result, payload);
      const resp = result.response.toJSON();

      if (payload.requestId !== resp.requestId) {
        resp.requestId = payload.requestId;

        if (!resp.raw) {
          resp.content.requestId = payload.requestId;
        }
      }

      debug('sending HTTP request response to client: %a', resp);

      if (resp.headers) {
        for (const header of Object.keys(resp.headers)) {
          response.setHeader(header, resp.headers[header]);
        }
      }

      const data = this._contentToPayload(resp, payload.url);

      this._compress(data, response, payload.headers, (err, buf) => {
        if (err) {
          const kuzerr = err instanceof KuzzleError ? err : new BadRequestError(err);
          return this._replyWithError(connectionId, payload, response, kuzerr);
        }

        response.writeHead(resp.status);
        response.end(buf);
        this.entryPoint.removeConnection(connectionId);
      });
    });
  }

  /**
   * Forward an error response to the client
   *
   * @param {string} connectionId
   * @param {Object} payload
   * @param {Object} response
   * @param {Object} error
   */
  _replyWithError(connectionId, payload, response, error) {
    const result = {
      raw: true,
      content: JSON.stringify(error)
    };

    debug('[%s] replyWithError: %a', connectionId, error);

    this.entryPoint.logAccess(new Request(payload, {error, connectionId}), payload);

    response.writeHead(error.status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods' : 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, Content-Length, Content-Encoding, X-Kuzzle-Volatile'
    });

    response.end(result.content);

    this.entryPoint.removeConnection(connectionId);
  }

  /**
   * Convert a Kuzzle query result into an appropriate payload format
   * to send back to the client
   *
   * @param {Object} result
   * @param {String} invokedUrl - invoked URL. Used to check if the ?pretty
   *                              argument was passed by the client, changing
   *                              the payload format
   * @return {Buffer}
   */
  _contentToPayload(result, invokedUrl) {
    let data;

    if (result.raw) {
      if (typeof result.content === 'object') {
        /*
         This object can be either a Buffer object, a stringified Buffer object,
         or anything else.
         In the former two cases, we create a new Buffer object, and in the latter,
         we stringify the content.
         */
        if (result.content instanceof Buffer || (result.content.type === 'Buffer' && Array.isArray(result.content.data))) {
          data = result.content;
        }
        else {
          data = JSON.stringify(result.content);
        }
      }
      else {
        // scalars are sent as-is
        data = result.content;
      }
    }
    else {
      let indent = 0;
      const parsedUrl = url.parse(invokedUrl, true);

      if (parsedUrl.query && parsedUrl.query.pretty !== undefined) {
        indent = 2;
      }

      data = JSON.stringify(result.content, undefined, indent);
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
   * Create a new Writable stream configured to receive a HTTP request
   * @param  {string} connectionId
   * @param  {Object} payload
   * @return {stream.Writable}
   */
  _createWriteStream(connectionId, payload) {
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
          return callback(new SizeLimitError('Maximum HTTP request size exceeded'));
        }

        const str = chunk.toString();

        debug('[%s] writing chunk: %a', connectionId, str);
        payload.content += str;
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

    if (typeof allowCompression !== 'boolean') {
      throw new Error('Invalid HTTP "allowCompression" parameter value: expected a boolean value');
    }

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
