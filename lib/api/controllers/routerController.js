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
  this.router = new HttpRouter();

  /**
   * Declares a new connection on a given protocol. Called by proxyBroker.
   *
   * @param {Request} request
   */
  this.newConnection = function routerNewConnection (request) {
    if (!request.context.connectionId || !request.context.protocol) {
      kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError('Rejected new connection - invalid arguments:' + JSON.stringify(request.context)));
    }
    else {
      this.connections[request.context.connectionId] = request.context;

      kuzzle.statistics.newConnection(this.connections[request.context.connectionId]);
    }
  };

  /**
   * Called by proxyBroker: removes a connection from the connection pool.
   *
   * @param {Request} request
   */
  this.removeConnection = function routerRemoveConnection (request) {
    var requestContext;

    if (!request.context.connectionId || !request.context.protocol) {
      kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError('Unable to remove connection - invalid arguments:' + JSON.stringify(request.context)));
    }
    else if (!this.connections[request.context.connectionId]) {
      kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError('Unable to remove connection - unknown connectionId:' + JSON.stringify(request.context.connectionId)));
    }
    else {
      requestContext = this.connections[request.context.connectionId];

      delete this.connections[request.context.connectionId];

      kuzzle.hotelClerk.removeCustomerFromAllRooms(requestContext);
      kuzzle.statistics.dropConnection(requestContext);
    }
  };

  /**
   * Initializes the HTTP routes for the Kuzzle REST API.
   */
  this.init = function routerInit () {
    let
      apiBase = '/api',
      api = apiBase + '/' + kuzzle.config.apiVersion,
      apiPlugin = api + '/_plugin';

    /*
     Registering the basic _serverInfo route
     This route is also used to get Kuzzle API Version, so it isn't registered under api/<version> but
     directly under api/
     */
    this.router.get(apiBase + '/_serverInfo', (data, cb) => {
      executeFromHttp(kuzzle.funnel, {controller: 'read', action: 'serverInfo'}, data, cb);
    });

    // create and mount a new router for plugins
    kuzzle.pluginsManager.routes.forEach(route => {
      this.router[route.verb](apiPlugin + '/' + route.url, (data, cb) => {
        executeFromHttp(kuzzle.funnel, {controller: route.controller, action: route.action}, data, cb);
      });
    });

    this.router.get(apiBase + '/swagger.json', (data, cb) => {
      let content = JSON.stringify(generateSwagger(kuzzle));
      cb(new HttpResponse(data.requestId, 'application/json', 200, content));
    });

    this.router.get(apiBase + '/swagger.yml', (data, cb) => {
      let content = jsonToYaml.stringify(generateSwagger(kuzzle));
      cb(new HttpResponse(data.requestId, 'application/yaml', 200, content));
    });

    // Register API routes
    this.kuzzle.config.httpRoutes.forEach(route => {
      this.router[route.verb](api + route.url, (data, cb) => {
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
 * @param {Object} params contains the request action and controller
 * @param {Request} request - includes URL and POST query data
 * @param {function} cb - callback to invoke with the result
 */
function executeFromHttp(funnel, params, request, cb) {
  request.input.controller = params.controller;
  request.input.action = params.action;
  request.context.protocol = 'rest';
  request.context.connectionId = '';

  funnel.execute(request, (err, result) => {
    /*
     * the funnel controller always return a result, even
     * if an error occured. In that case, the result is
     * the result will contain the equivalent of the raised error.
     */
    cb(new HttpResponse(result.id, 'application/json', result.status, JSON.stringify(result.response)));
  });
}

/**
 * @type {RouterController}
 */
module.exports = RouterController;
