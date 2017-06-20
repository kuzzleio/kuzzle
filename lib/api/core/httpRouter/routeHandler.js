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

const Request = require('kuzzle-common-objects').Request;

/**
 * Object returned by routePart.getHandler(),
 * containing the information gathered about
 * a requested route and the corresponding handler
 * to invoke
 *
 * @class RouteHandler
 * @param {string} url - parsed URL
 * @param {string} requestId
 * @param {object} query - HTTP request query parameters
 * @param {object} headers
 */
class RouteHandler {
  constructor(url, query, requestId, headers) {
    this.handler = null;
    this.url = url;
    this.data = {requestId};
    this.headers = headers;
    this.request = null;

    Object.keys(headers).forEach(k => {
      if (k.toLowerCase() === 'authorization' && headers[k].startsWith('Bearer ')) {
        this.data.jwt = headers[k].substring('Bearer '.length);
      }
      else {
        this.data[k] = headers[k];
      }
    });

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
   * @throws
   * @param {string} content
   */
  addContent(content) {
    this.getRequest().input.body = JSON.parse(content);
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
      connectionId: this.data.requestId,
      protocol: 'http'
    });
    this.request.input.headers = this.headers;

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
