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
  Writable = require('stream').Writable,
  HttpFormDataStream = require('../service/httpFormDataStream'),
  {
    BadRequestError,
    SizeLimitError
  } = require('kuzzle-common-objects').errors,
  Request = require('kuzzle-common-objects').Request;

/**
 * @class HttpProtocol
 */
class HttpProtocol extends Protocol {
  constructor() {
    super();

    this.maxRequestSize = null;
    this.maxFormFileSize = null;
    this.server = null;
  }

  /**
   * Initializes the HTTP server
   *
   * @param {EmbeddedEntryPoint} entryPoint
   */
  init(entryPoint) {
    this.entryPoint = entryPoint;

    debug('initializing http Server with config: %a', entryPoint.config);

    this.maxRequestSize = bytes.parse(entryPoint.config.maxRequestSize);
    this.maxFormFileSize = bytes.parse(entryPoint.config.protocols.http.maxFormFileSize);

    this.server = entryPoint.httpServer;

    if (this.maxRequestSize === null || isNaN(this.maxRequestSize)) {
      throw new Error('Invalid HTTP "maxRequestSize" parameter');
    }

    if (this.maxFormFileSize === null || isNaN(this.maxFormFileSize)) {
      throw new Error('Invalid HTTP "maxFormFileSize" parameter');
    }

    this.server.on('request', (request, response) => {
      const payload = {
        requestId: uuid.v4(),
        url: request.url,
        method: request.method,
        headers: request.headers,
        content: ''
      };
      let
        stream,
        streamLength = 0,
        ips = [request.socket.remoteAddress];

      if (request.headers['x-forwarded-for']) {
        ips = request.headers['x-forwarded-for']
          .split(',')
          .map(s => s.trim())
          .concat(ips);
      }

      const connection = new ClientConnection('HTTP/' + request.httpVersion, ips, request.headers);
      debug('[%s] receiving HTTP request: %a', connection.id, payload);
      this.entryPoint.newConnection(connection);

      if (request.headers['content-length'] > this.maxRequestSize) {
        request
          .removeAllListeners()
          .resume();
        return this._replyWithError(connection.id, payload, response, new SizeLimitError('Error: maximum HTTP request size exceeded'));
      }

      if (!request.headers['content-type'] || request.headers['content-type'].startsWith('application/json')) {
        stream = new Writable({
          write(chunk, encoding, callback) {
            debug('[%s] writing chunk: %a', connection.id, chunk.toString());
            payload.content += chunk.toString();
            callback();
          }
        });

        stream.on('error', err => {
          debug('[%s] stream error: %a', connection.id, err);
          stream.end();
          request
            .removeAllListeners('data')
            .removeAllListeners('end')
            .resume();
          return this._replyWithError(connection.id, payload, response, err);
        });
      } else {
        try {
          stream = new HttpFormDataStream({
            headers: request.headers,
            limits: {fileSize: this.maxFormFileSize}
          }, payload);
        } catch (error) {
          request.resume();
          return this._replyWithError(connection.id, payload, response, new BadRequestError(error.message));
        }

        stream.on('error', err => {
          debug('[%s] stream error:\n%O', connection.id, err);
          /*
           * Force Dicer parser to finish prematurely
           * without throwing an 'Unexpected end of multipart data' error :
           */
          stream._parser.parser._finished = true;
          stream.end();

          request
            .removeAllListeners('data')
            .removeAllListeners('end')
            .resume();
          return this._replyWithError(connection.id, payload, response, err);
        });
      }

      request.on('data', chunk => {
        debug('[%s] receiving chunk data: %a', connection.id, chunk.toString());

        streamLength += chunk.length;

        /*
         * The content-length header can be bypassed and
         * is not reliable enough. We have to enforce the HTTP
         * max size limit while reading the stream too
         */
        if (streamLength > this.maxRequestSize) {
          return stream.emit('error', new SizeLimitError('Error: maximum HTTP request size exceeded'));
        }
        stream.write(chunk);
      });

      request.on('end', () => {
        debug('[%s] End Request', connection.id);
        stream.end(() => {
          payload.headers['content-type'] = 'application/json';
          this._sendRequest(connection.id, response, payload);
        });
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

      debug('sending HTTP request response to proxy: %a', resp);
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
      'Access-Control-Allow-Methods' : 'GET,POST,PUT,DELETE,OPTIONS',
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

}

module.exports = HttpProtocol;
