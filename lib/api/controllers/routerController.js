'use strict';

var
  HttpRouter = require('../core/httpRouter'),
  PluginImplementationError = require('kuzzle-common-objects').errors.PluginImplementationError,
  HttpResponse = require('../core/entryPoints/httpResponse'),
  generateSwagger = require('../core/swagger'),
  jsonToYaml = require('json2yaml');

/**
 * @property action
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function RouterController (kuzzle) {
  this.kuzzle = kuzzle;
  this.connections = {};
  this.router = new HttpRouter(kuzzle);

  /**
   * Declares a new connection on a given protocol. Called by proxyBroker.
   *
   * @param {RequestContext} requestContext
   */
  this.newConnection = function routerNewConnection (requestContext) {
    if (!requestContext.connectionId || !requestContext.protocol) {
      kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError('Rejected new connection - invalid arguments:' + JSON.stringify(requestContext)));
    }
    else {
      this.connections[requestContext.connectionId] = requestContext;

      kuzzle.statistics.newConnection(this.connections[requestContext.connectionId]);
    }
  };

  /**
   * Called by proxyBroker: removes a connection from the connection pool.
   *
   * @param {RequestContext} requestContext
   */
  this.removeConnection = function routerRemoveConnection (requestContext) {
    if (!requestContext.connectionId || !requestContext.protocol) {
      kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError('Unable to remove connection - invalid arguments:' + JSON.stringify(requestContext.context)));
    }
    else if (!this.connections[requestContext.connectionId]) {
      kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError('Unable to remove connection - unknown connectionId:' + JSON.stringify(requestContext.connectionId)));
    }
    else {
      delete this.connections[requestContext.connectionId];

      kuzzle.hotelClerk.removeCustomerFromAllRooms(requestContext);
      kuzzle.statistics.dropConnection(requestContext);
    }
  };

  /**
   * Initializes the HTTP routes for the Kuzzle HTTP API.
   */
  this.init = function routerInit () {
    // create and mount a new router for plugins
    kuzzle.pluginsManager.routes.forEach(route => {
      this.router[route.verb]('/_plugin/' + route.url, (data, cb) => {
        executeFromHttp(kuzzle.funnel, {controller: route.controller, action: route.action}, data, cb);
      });
    });

    this.router.get('/swagger.json', (request, cb) => {
      request.setResult(generateSwagger(kuzzle), {
        status: 200,
        raw: true,
        headers: {'content-type': 'application/json'}
      });

      cb(new HttpResponse(request.id, 200, request.response));
    });

    this.router.get('/swagger.yml', (request, cb) => {
      request.setResult(jsonToYaml.stringify(generateSwagger(kuzzle)), {
        status: 200,
        raw: true,
        headers: {'content-type': 'application/yaml'}
      });

      cb(new HttpResponse(request.id, 200, request.response));
    });

    // Register API routes
    this.kuzzle.config.http.routes.forEach(route => {
      this.router[route.verb](route.url, (data, cb) => {
        executeFromHttp(kuzzle.funnel, {controller: route.controller, action: route.action}, data, cb);
      });
    });
  };
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
  request.context.protocol = 'http';
  request.context.connectionId = 'http';

  funnel.execute(request, (err, result) => {
    cb(new HttpResponse(result.id, result.status, result.response));
  });
}

/**
 * @type {RouterController}
 */
module.exports = RouterController;
