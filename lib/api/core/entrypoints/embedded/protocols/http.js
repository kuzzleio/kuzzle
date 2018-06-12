/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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
  uuid = require('uuid'),
  url = require('url'),
  ClientConnection = require('../clientConnection'),
  Protocol = require('./protocol'),
  {
    Writable,
    PassThrough
  } = require('stream'),
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
    this.maxEncodings = 0;
    this.allowCompression = false;
    this.decoders = {};
  }

  /**
   * Initializes the HTTP server
   *
   * @param {EmbeddedEntryPoint} entryPoint
   */
  init(entryPoint) {
    super.init(entryPoint);

    debug('initializing http Server with config: %a', entryPoint.config);

    this.maxFormFileSize = bytes.parse(entryPoint.config.protocols.http.maxFormFileSize);
    this.maxEncodings = entryPoint.config.protocols.http.maxEncodingsCount;
    this.server = entryPoint.httpServer;

    for (const numericParameter of ['maxFormFileSize', 'maxEncodings']) {
      if (this[numericParameter] === null || isNaN(this[numericParameter])) {
        throw new Error(`Invalid HTTP "${numericParameter}" parameter value: expected a numeric value`);
      }
    }

    this.decoders = this._setDecoders();

    this.server.on('request', (request, response) => {
      const
        payload = {
          requestId: uuid.v4(),
          url: request.url,
          method: request.method,
          headers: request.headers,
          content: ''
        },
        ips = [request.socket.remoteAddress];
      let stream;

      if (request.headers['x-forwarded-for']) {
        request.headers['x-forwarded-for'].split(',').forEach(s => ips.push(s.trim()));
      }

      if (request.headers['content-length'] > this.maxRequestSize) {
        request.resume();
        return this._replyWithError(connection.id, payload, response, new SizeLimitError('Error: maximum HTTP request size exceeded'));
      }

      const connection = new ClientConnection('HTTP/' + request.httpVersion, ips, request.headers);
      debug('[%s] receiving HTTP request: %a', connection.id, payload);
      this.entryPoint.newConnection(connection);

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
   * Sends a request to Kuzzle and forwards the response back to the client
   *
   * @param {string} connectionId - connection Id
   * @param {ServerResponse} response
   * @param {Object} payload
   */
  _sendRequest (connectionId, response, payload) {
    debug('[%s] sendRequest: %a', connectionId, payload);

    if (payload.json) {
      payload.content = JSON.stringify(payload.json);
      delete payload.json;
    }

    this.entryPoint.kuzzle.router.http.route(payload, result => {
      result.context.protocol = 'http';
      result.context.connectionId = connectionId;

      this.entryPoint.logAccess(result, payload);
      const resp = result.response.toJSON();

      if (payload.requestId !== resp.requestId) {
        resp.requestId = payload.requestId;

        if (!resp.raw) {
          resp.content.requestId = payload.requestId;
        }
      }

      debug('sending HTTP request response to client: %a', resp);
      this.entryPoint.removeConnection(connectionId);

      if (resp.headers) {
        for (const header of Object.keys(resp.headers)) {
          response.setHeader(header, resp.headers[header]);
        }
      }
      response.writeHead(resp.status);
      response.end(this._contentToPayload(resp, payload.url));

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
      'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With'
    });

    response.end(result.content);

    delete this.entryPoint.clients[connectionId];
  }

  /**
   * Converts a Kuzzle query result into an appropriate payload format
   * to send back to the client
   *
   * @param {Object} result
   * @param {String} invokedUrl - invoked URL. Used to check if the ?pretty
   *                              argument was passed by the client, changing
   *                              the payload format
   * @return {String|Buffer}
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
          data = Buffer.from(result.content);
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

    return data;
  }

  /**
   * Returns a new Readable Stream configured with
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
      const encodings = request.headers['content-encoding'].split(',');

      if (encodings.length > this.maxEncodingsCount) {
        throw new BadRequestError('Too many encodings');
      }

      for (const encoding of encodings) {
        const trimmed = encoding.trim();
        let pipe = null;

        if (this.decoders[trimmed]) {
          pipe = this.decoders[trimmed]();
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
          return callback(new SizeLimitError('Error: maximum HTTP request size exceeded'));
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

    if (typeof this.allowCompression !== 'boolean') {
      throw new Error('Invalid HTTP "allowCompression" parameter value: expected a boolean');
    }

    // for now, we accept gzip, deflate and identity
    const decoders = {};
    decoders.gzip = allowCompression ? zlib.createGunzip : disabledfn;
    decoders.inflate = allowCompression ? zlib.createInflate : disabledfn;
    decoders.identity = () => new PassThrough();
  }
}

module.exports = HttpProtocol;
