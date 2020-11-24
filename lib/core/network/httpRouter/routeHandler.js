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

const { Request } = require('../../../api/request');
const kerror = require('../../../kerror').wrap('network', 'http');

/**
 * Object returned by routePart.getHandler(),
 * containing the information gathered about
 * a requested route and the corresponding handler
 * to invoke
 *
 * @class RouteHandler
 * @param {string} url - parsed URL
 * @param {object} query - parsed query string
 * @param {HttpMessage} message
 * @throws {BadRequestError} If x-kuzzle-volatile HTTP header can not be parsed
 *                           in JSON format
 */
class RouteHandler {
  constructor(url, query, message) {
    this.handler = null;
    this._request = null;
    this.url = url;

    this.data = {
      body: message.content,
      requestId: message.requestId,
      ...query
    };

    this.connection = {
      connection: {
        headers: message.headers,
        id: message.connection.id,
        ips: message.ips,
        path: message.path,
        protocol: 'http',
        // @deprecated use "path" instead
        url: message.url,
        verb: message.method
      }
    };

    for (const k of Object.keys(message.headers)) {
      if ( k.toLowerCase() === 'authorization'
        && message.headers[k].toLowerCase().startsWith('bearer ')
      ) {
        this.data.jwt = message.headers[k].substring('Bearer '.length);
      }
      else if (k.toLowerCase() === 'x-kuzzle-volatile') {
        try {
          this.data.volatile = JSON.parse(message.headers[k]);
        }
        catch (e) {
          throw kerror.getFrom(e, 'volatile_parse_failed', e.message);
        }
      }
    }
  }

  get request () {
    if (this._request === null) {
      this._request = new Request(this.data, this.connection);
    }

    return this._request;
  }

  /**
   * Add a parametric argument to the request object
   * @param {string} name
   * @param {string} value
   */
  addArgument(name, value) {
    this.data[name] = value;
  }

  /**
   * Invokes the registered handler
   *
   * @param {Function} callback
   */
  invokeHandler(callback) {
    this.handler(this.request, callback);
  }
}

/**
 * @type {RouteHandler}
 */
module.exports = RouteHandler;
