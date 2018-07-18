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
  HttpRouter = require('../core/httpRouter'),
  PluginImplementationError = require('kuzzle-common-objects').errors.PluginImplementationError,
  generateSwagger = require('../core/swagger'),
  jsonToYaml = require('json2yaml');

/**
 * @class RouterController
 * @property action
 * @param {Kuzzle} kuzzle
 */
class RouterController {
  constructor(kuzzle) {
    this.kuzzle = kuzzle;
    this.connections = {};
    this.http = new HttpRouter(kuzzle);
  }

  /**
   * Declares a new connection on a given protocol. Called by proxyBroker.
   *
   * @param {RequestContext} requestContext
   */
  newConnection(requestContext) {
    if (!requestContext.connection.id || !requestContext.connection.protocol) {
      this.kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError('Rejected new connection - invalid arguments:' + JSON.stringify(requestContext)));
    }
    else {
      this.connections[requestContext.connection.id] = requestContext;

      this.kuzzle.statistics.newConnection(this.connections[requestContext.connection.id]);
    }
  }

  /**
   * Called by proxyBroker: removes a connection from the connection pool.
   *
   * @param {RequestContext} requestContext
   */
  removeConnection(requestContext) {
    if (!requestContext.connection.id || !requestContext.connection.protocol) {
      return this.kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError('Unable to remove connection - invalid arguments:' + JSON.stringify(requestContext.context)));
    }

    if (!this.connections[requestContext.connection.id]) {
      return this.kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError('Unable to remove connection - unknown connection identifier:' + JSON.stringify(requestContext.connection.id)));
    }

    delete this.connections[requestContext.connection.id];

    this.kuzzle.hotelClerk.removeCustomerFromAllRooms(requestContext);

    this.kuzzle.statistics.dropConnection(requestContext);
  }

  /**
   * Check that the provided connection id executing a request is still alive
   *
   * @param  {RequestContext} requestContext
   */
  isConnectionAlive(requestContext) {
    // We only care about connections that stay open
    if (requestContext.connection.protocol === 'http') {
      return true;
    }

    return this.connections[requestContext.connection.id] !== undefined;
  }

  /**
   * Initializes the HTTP routes for the Kuzzle HTTP API.
   */
  init() {
    // create and mount a new router for plugins
    this.kuzzle.pluginsManager.routes.forEach(route => {
      this.http[route.verb]('/_plugin/' + route.url, (data, cb) => {
        this._executeFromHttp(route, data, cb);
      });
    });

    this.http.get('/swagger.json', (request, cb) => {
      request.setResult(generateSwagger(this.kuzzle), {
        status: 200,
        raw: true,
        headers: {'content-type': 'application/json'}
      });

      cb(request);
    });

    this.http.get('/swagger.yml', (request, cb) => {
      request.setResult(jsonToYaml.stringify(generateSwagger(this.kuzzle)), {
        status: 200,
        raw: true,
        headers: {'content-type': 'application/yaml'}
      });

      cb(request);
    });

    // Register API routes
    this.kuzzle.config.http.routes.forEach(route => {
      this.http[route.verb](route.url, (data, cb) => {
        this._executeFromHttp(route, data, cb);
      });
    });
  }

  /**
   * Transmit HTTP requests to the funnel controller and forward its response back to
   * the client
   *
   * @param {object} route contains the request action, controller and verb
   * @param {Request} request - includes URL and POST query data
   * @param {function} cb - callback to invoke with the result
   */
  _executeFromHttp(route, request, cb) {
    request.input.controller = route.controller;
    request.input.action = route.action;

    this.kuzzle.pluginsManager.trigger(`http:${route.verb}`, request)
      .then(mutatedRequest => {
        this.kuzzle.funnel.execute(mutatedRequest, (err, result) => {
          cb(result);
        });

        // otherwise bluebird complains about the promise not
        // returning anything
        return null;
      })
      .catch(error => {
        request.setError(error);

        cb(request);
      });
  }
}

/**
 * @type {RouterController}
 */
module.exports = RouterController;
