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

const { Request } = require('../../api/request');
const kerror = require('../../kerror');
const HttpRouter = require('./httpRouter');

/**
 * @class Router
 * @property action
 * @param {Kuzzle} kuzzle
 */
class Router {
  constructor(kuzzle) {
    this.kuzzle = kuzzle;
    this.connections = new Map();
    this.http = new HttpRouter(kuzzle);
    this.routes = [];
  }

  /**
   * Declares a new connection attached to a network protocol.
   *
   * @param {RequestContext} requestContext
   */
  newConnection (requestContext) {
    if (!requestContext.connection.id || !requestContext.connection.protocol) {
      this.kuzzle.log.error(kerror.get(
        'protocol',
        'runtime',
        'invalid_connection',
        JSON.stringify(requestContext)));
    } else {
      this.connections.set(requestContext.connection.id, requestContext);
      this.kuzzle.statistics.newConnection(requestContext);
    }
  }

  /**
   * Removes a connection from the connection pool.
   *
   * @param {RequestContext} requestContext
   */
  removeConnection (requestContext) {
    const connId = requestContext.connection.id;

    if (!connId || !requestContext.connection.protocol) {
      this.kuzzle.log.error(kerror.get(
        'protocol',
        'runtime',
        'invalid_connection',
        JSON.stringify(requestContext.context)));
      return;
    }

    if (!this.connections.has(connId)) {
      this.kuzzle.log.error(kerror.get(
        'protocol',
        'runtime',
        'unknown_connection',
        JSON.stringify(connId)));
      return;
    }

    this.connections.delete(connId);

    this.kuzzle
      .ask('core:realtime:user:remove', requestContext.connection.id)
      .catch(err => this.kuzzle.log.info(err));

    this.kuzzle.statistics.dropConnection(requestContext);
  }

  /**
   * Check that the provided connection id executing a request is still alive
   *
   * @param  {RequestContext} requestContext
   */
  isConnectionAlive (requestContext) {
    // Check only defined connection identifiers (some protocols might
    // not have one)
    return requestContext.connection.id === null
      || this.connections.has(requestContext.connection.id);
  }

  /**
   * Initializes the HTTP routes for the Kuzzle HTTP API.
   */
  async init() {
    const pluginRoutes = await this.kuzzle.ask('core:plugin:routes:get');

    // Store API and Plugin routes for later use by other modules.
    this.routes = [
      ...this.kuzzle.config.http.routes,
      ...pluginRoutes
    ];

    /**
     * Gets all the existing routes
     * Both HTTP Api and Plugins
     * @returns {Array.<Object>} Routes
     */
    this.kuzzle.onAsk('core:network:http:routes:get', () => this.routes);

    this.http.post('_query', (request, cb) => {
      // We need to build a new request from the body
      // and we also need to keep the original request context
      const apiRequest = new Request(
        request.input.body,
        request.serialize().options);

      this._executeFromHttp('post', apiRequest, cb);
    });

    for (const route of this.routes) {
      const verb = route.verb.toLowerCase();

      this.http[verb](route.path, (request, cb) => {
        request.input.controller = route.controller;
        request.input.action = route.action;

        if (route.deprecated) {
          const { deprecated : { since, message } } = route;
          request.addDeprecation(since, message);
        }

        this._executeFromHttp(route.verb, request, cb);
      });
    }
  }

  /**
   * Transmit HTTP requests to the funnel controller and forward its response
   * back to the client
   *
   * @param {String} verb
   * @param {Request} request - includes URL and POST query data
   * @param {function} cb - callback to invoke with the result
   */
  _executeFromHttp (verb, request, cb) {
    this.kuzzle.pipe(`http:${verb}`, request, (error, mutatedRequest) => {
      if (error) {
        request.setError(error);
        cb(request);
      }
      else {
        this.kuzzle.funnel.execute(mutatedRequest, (err, result) => cb(result));
      }
    });
  }
}

/**
 * @type {RouterController}
 */
module.exports = Router;
