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
  constructor() {
    this.connections = new Map();
    this.http = new HttpRouter();
  }

  /**
   * Declares a new connection attached to a network protocol.
   *
   * @param {RequestContext} requestContext
   */
  newConnection (requestContext) {
    if (!requestContext.connection.id || !requestContext.connection.protocol) {
      global.kuzzle.log.error(kerror.get(
        'protocol',
        'runtime',
        'invalid_connection',
        JSON.stringify(requestContext)));
    }
    else {
      this.connections.set(requestContext.connection.id, requestContext);
      global.kuzzle.statistics.newConnection(requestContext);
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
      global.kuzzle.log.error(kerror.get(
        'protocol',
        'runtime',
        'invalid_connection',
        JSON.stringify(requestContext.context)));
      return;
    }

    if (!this.connections.has(connId)) {
      global.kuzzle.log.error(kerror.get(
        'protocol',
        'runtime',
        'unknown_connection',
        JSON.stringify(connId)));
      return;
    }

    this.connections.delete(connId);

    global.kuzzle.statistics.dropConnection(requestContext);
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
  init () {
    // Register API and plugin routes
    const routes = [
      ...global.kuzzle.config.http.routes,
      ...global.kuzzle.pluginsManager.routes
    ];

    this.http.post('_query', (request, cb) => {
      // We need to build a new request from the body
      // and we also need to keep the original request context
      const requestPayload = request.input.body;

      if (request.input.jwt && requestPayload.jwt === undefined) {
        requestPayload.jwt = request.input.jwt;
      }

      const apiRequest = new Request(
        requestPayload,
        request.serialize().options);

      this._executeFromHttp('post', apiRequest, cb);
    });

    for (const route of routes) {
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

    /**
     * Returns inner metrics from the router
     * @returns {Object}
     */
    global.kuzzle.onAsk(
      'core:network:router:metrics',
      () => this.metrics());
  }

  /**
   * Returns the metrics of the router
   * @returns {Object}
   */
  metrics () {
    const connectionsByProtocol = {};

    for (const connection of this.connections.values()) {
      const protocol = connection.connection.protocol.toLowerCase();
      if (protocol === 'internal') {
        continue;
      }

      if (connectionsByProtocol[protocol] === undefined) {
        connectionsByProtocol[protocol] = 0;
      }

      connectionsByProtocol[protocol]++;
    }

    return {
      connections: connectionsByProtocol,
    };
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
    global.kuzzle.pipe(`http:${verb}`, request, (error, mutatedRequest) => {
      if (error) {
        request.setError(error);
        cb(request);
      }
      else {
        global.kuzzle.funnel.execute(mutatedRequest, (err, result) => cb(result));
      }
    });
  }
}

/**
 * @type {RouterController}
 */
module.exports = Router;
