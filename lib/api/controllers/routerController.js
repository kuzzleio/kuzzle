'use strict';

var
  Promise = require('bluebird'),
  HttpRouter = require('../core/httpRouter'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  PluginImplementationError = require('kuzzle-common-objects').errors.PluginImplementationError,
  RequestContext = require('kuzzle-common-objects').models.RequestContext,
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

  // used only for core-dump analysis
  this.requestHistory = [];

  /**
   * Declares a new connection on a given protocol. Called by proxy broker.
   * Returns a userContext object to be used with router.execute() and router.removeConnection()
   *
   * @param {string} protocol - protocol name
   * @param {string} connectionId - unique connection identifier
   * @return {Promise} connection context, to be used with other router functions
   */
  this.newConnection = function routerNewConnection (protocol, connectionId) {
    var error;

    if (!connectionId || !protocol || typeof connectionId !== 'string' || typeof protocol !== 'string') {
      error = new PluginImplementationError('Rejected new connection declaration: invalid arguments');
      kuzzle.pluginsManager.trigger('log:error', error);
      return Promise.reject(error);
    }

    if (!this.connections[connectionId]) {
      this.connections[connectionId] = new RequestContext({
        connectionId,
        protocol
      });
    }

    kuzzle.statistics.newConnection(this.connections[connectionId]);

    return Promise.resolve(this.connections[connectionId]);
  };

  /**
   * Called by protocol plugins: forward a received request to Kuzzle.
   * Resolves a callback with the corresponding controller response
   *
   * A note about the JWT headers: if this value is falsey, if no "authorization" field is found, if the token is not
   * properly formatted or if the token itself is invalid, then the corresponding user will automatically
   * be set to "anonymous".
   *
   * @param {*} incomingRequest
   * @param {Function} callback
   * @return {Promise<Request>}
   */
  this.execute = function routerExecute (incomingRequest, callback) {
    var
      error,
      request;

    if (this.requestHistory.length > kuzzle.config.server.maxRequestHistorySize) {
      this.requestHistory.shift();
    }

    this.requestHistory.push(request);
    // TODO in progress

    if (!userContext || !userContext.connection) {
      error = new PluginImplementationError('Unable to execute request: ' + requestObject +
        '\nReason: invalid context. Use context.getRouter().newConnection() to get a valid context.');
      kuzzle.pluginsManager.trigger('log:error', error);
      return callback(error, new ResponseObject(requestObject, error));
    }

    if (!userContext.connection.id || !this.connections[userContext.connection.id]) {
      error = new PluginImplementationError('Unable to execute request: unknown context. ' +
        'Has context.getRouter().newConnection() been called before executing requests?');
      kuzzle.pluginsManager.trigger('log:error', error);
      return callback(error, new ResponseObject(requestObject, error));
    }

    kuzzle.funnel.execute(requestObject, userContext, callback);
  };

  /**
   * Called by protocol plugins: removes a connection from the connection pool.
   * @param {object} connectionContext - connection context, obtained using the newConnection() method
   */
  this.removeConnection = function routerRemoveConnection (connectionContext) {
    var requestContext;

    if (connectionContext.connection && connectionContext.connection.id && this.connections[connectionContext.connection.id]) {
      requestContext = this.connections[connectionContext.connection.id];

      delete this.connections[connectionContext.connection.id];

      kuzzle.hotelClerk.removeCustomerFromAllRooms(requestContext);
      kuzzle.statistics.dropConnection(requestContext);
    }
    else {
      kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError('Unable to remove connection: ' +
        JSON.stringify(connectionContext) + '.\nReason: unknown context'));
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
 * @param {object} funnel controller
 * @param params contains the request action and controller
 * @param {KuzzleRequest} request - includes URL and POST query data
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
    cb(new HttpResponse(result.requestId, 'application/json', result.status, JSON.stringify(result)));
  });
}

/**
 * @type {RouterController}
 */
module.exports = RouterController;
