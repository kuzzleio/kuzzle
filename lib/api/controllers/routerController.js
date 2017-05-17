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
    this.router = new HttpRouter(kuzzle);
  }

  /**
   * Declares a new connection on a given protocol. Called by proxyBroker.
   *
   * @param {RequestContext} requestContext
   */
  newConnection(requestContext) {
    if (!requestContext.connectionId || !requestContext.protocol) {
      this.kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError('Rejected new connection - invalid arguments:' + JSON.stringify(requestContext)));
    }
    else {
      this.connections[requestContext.connectionId] = requestContext;

      this.kuzzle.statistics.newConnection(this.connections[requestContext.connectionId]);
    }
  }

  /**
   * Called by proxyBroker: removes a connection from the connection pool.
   *
   * @param {RequestContext} requestContext
   */
  removeConnection(requestContext) {
    if (!requestContext.connectionId || !requestContext.protocol) {
      this.kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError('Unable to remove connection - invalid arguments:' + JSON.stringify(requestContext.context)));
    }
    else if (!this.connections[requestContext.connectionId]) {
      this.kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError('Unable to remove connection - unknown connectionId:' + JSON.stringify(requestContext.connectionId)));
    }
    else {
      delete this.connections[requestContext.connectionId];

      this.kuzzle.hotelClerk.removeCustomerFromAllRooms(requestContext);
      this.kuzzle.statistics.dropConnection(requestContext);
    }
  }

  /**
   * Initializes the HTTP routes for the Kuzzle HTTP API.
   */
  init() {
    // create and mount a new router for plugins
    this.kuzzle.pluginsManager.routes.forEach(route => {
      this.router[route.verb]('/_plugin/' + route.url, (data, cb) => {
        executeFromHttp(this.kuzzle.funnel, {controller: route.controller, action: route.action}, data, cb);
      });
    });

    this.router.get('/swagger.json', (request, cb) => {
      request.setResult(generateSwagger(this.kuzzle), {
        status: 200,
        raw: true,
        headers: {'content-type': 'application/json'}
      });

      cb(request.response);
    });

    this.router.get('/swagger.yml', (request, cb) => {
      request.setResult(jsonToYaml.stringify(generateSwagger(this.kuzzle)), {
        status: 200,
        raw: true,
        headers: {'content-type': 'application/yaml'}
      });

      cb(request.response);
    });

    // Register API routes
    this.kuzzle.config.http.routes.forEach(route => {
      this.router[route.verb](route.url, (data, cb) => {
        executeFromHttp(this.kuzzle.funnel, {controller: route.controller, action: route.action}, data, cb);
      });
    });
  }
}

/**
 * Transmit HTTP requests to the funnel controller and forward its response back to
 * the client
 *
 * @param {FunnelController} funnel controller
 * @param {object} params contains the request action and controller
 * @param {Request} request - includes URL and POST query data
 * @param {function} cb - callback to invoke with the result
 */
function executeFromHttp(funnel, params, request, cb) {
  request.input.controller = params.controller;
  request.input.action = params.action;

  funnel.execute(request, (err, result) => {
    cb(result.response);
  });
}

/**
 * @type {RouterController}
 */
module.exports = RouterController;
