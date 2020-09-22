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

const kerror = require('../../kerror');
const HttpRouter = require('./httpRouter');
const generateSwagger = require('../../api/swagger');
const jsonToYaml = require('json2yaml');

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
  }

  /**
   * Declares a new connection attached to a network protocol.
   *
   * @param {RequestContext} requestContext
   */
  newConnection(requestContext) {
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
   * @param  {String} connectionId
   */
  isConnectionAlive(connectionId) {
    // Check only defined connection identifiers (some protocols might
    // not have one)
    return connectionId === null
      || this.connections.has(connectionId);
  }

  /**
   * Initializes the HTTP routes for the Kuzzle HTTP API.
   */
  init () {
    // Register API and plugin routes
    const routes = [
      ...this.kuzzle.config.http.routes,
      ...this.kuzzle.pluginsManager.routes
    ];

    for (const route of routes) {
      const verb = route.verb.toLowerCase();
      this.http[verb](route.path, (data, cb) => {
        this._executeFromHttp(route, data, cb);
      });
    }

    this.http.get('/swagger.json', (request, cb) => {
      request.setResult(generateSwagger(this.kuzzle), {
        headers: {'content-type': 'application/json'},
        raw: true,
        status: 200
      });

      cb(request);
    });

    this.http.get('/swagger.yml', (request, cb) => {
      request.setResult(jsonToYaml.stringify(generateSwagger(this.kuzzle)), {
        headers: {'content-type': 'application/yaml'},
        raw: true,
        status: 200
      });

      cb(request);
    });
  }

  /**
   * Transmit HTTP requests to the funnel controller and forward its response
   * back to the client
   *
   * @param {object} route contains the request action, controller and verb
   * @param {Request} request - includes URL and POST query data
   * @param {function} cb - callback to invoke with the result
   */
  _executeFromHttp(route, request, cb) {
    request.input.controller = route.controller;
    request.input.action = route.action;

    this.kuzzle.pipe(`http:${route.verb}`, request, (error, mutatedRequest) => {
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
