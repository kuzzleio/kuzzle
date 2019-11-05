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
  { Request } = require('kuzzle-common-objects'),
  errorsManager = require('../../../util/errors').wrap('network', 'http');

/**
 * Object returned by routePart.getHandler(),
 * containing the information gathered about
 * a requested route and the corresponding handler
 * to invoke
 *
 * @class RouteHandler
 * @param {string} url - parsed URL
 * @param {object} query - parsed query string
 * @param {object} httpRequest - raw HTTP request informations
 * @throws {BadRequestError} If x-kuzzle-volatile HTTP header can not be parsed in JSON format
 */
class RouteHandler {
  constructor(url, query, httpRequest) {
    this.handler = null;
    this.url = url;
    this.request = null;
    this.httpRequest = httpRequest;
    this.data = {
      requestId: this.httpRequest.requestId
    };

    for (const k of Object.keys(this.httpRequest.headers)) {
      if (k.toLowerCase() === 'authorization'
        && this.httpRequest.headers[k].startsWith('Bearer ')
      ) {
        this.data.jwt = this.httpRequest.headers[k].substring('Bearer '.length);
      } else if (k.toLowerCase() === 'x-kuzzle-volatile') {
        try {
          this.data.volatile = JSON.parse(this.httpRequest.headers[k]);
        } catch (e) {
          errorsManager.throwFrom(e, 'volatile_parse_failed', e.message);
        }
      }
    }

    Object.assign(this.data, query);
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
   * Parse a string content and adds it to the right request object place
   *
   * @param {string} content
   * @throws {BadRequestError} If the HTTP body can not be parsed in JSON format
   */
  addContent(content) {
    try {
      this.getRequest().input.body = JSON.parse(content);
    } catch (e) {
      errorsManager.throwFrom(e, 'body_parse_failed', e.message);
    }
  }

  /**
   * Builds the request object and returns it
   *
   * @return {Request}
   */
  getRequest() {
    if (this.request !== null) {
      return this.request;
    }

    this.request = new Request(this.data, {
      connection: {
        id: this.data.requestId,
        protocol: 'http',
        url: this.url,
        headers: this.httpRequest.headers,
        ips: this.httpRequest.ips,
        proxy: this.httpRequest.proxy
      }
    });

    return this.request;
  }

  /**
   * Invokes the registered handler
   *
   * @param {Function} callback
   */
  invokeHandler(callback) {
    this.handler(this.getRequest(), callback);
  }
}

/**
 * @type {RouteHandler}
 */
module.exports = RouteHandler;
