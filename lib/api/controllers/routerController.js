'use strict';

var
  Promise = require('bluebird'),
  HttpRouter = require('../core/httpRouter'),
  ResponseObject = require('kuzzle-common-objects').Models.responseObject,
  PluginImplementationError = require('kuzzle-common-objects').Errors.pluginImplementationError,
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
   * Returns a context object to be used with router.execute() and router.removeConnection()
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
      this.connections[connectionId] = {
        connection: {type: protocol, id: connectionId},
        token: null
      };
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
   * @param {RequestObject} requestObject - the request to execute
   * @param {{connection: {id: String}}} context - connection context, obtained using the newConnection() method
   * @param {Function} callback
   * @return {Promise} ResponseObject
   */
  this.execute = function routerExecute (requestObject, context, callback) {
    var error;

    if (this.requestHistory.length > kuzzle.config.server.maxRequestHistorySize) {
      this.requestHistory.shift();
    }
    this.requestHistory.push({requestObject, context});

    if (!requestObject) {
      error = new PluginImplementationError('Request execution error: no provided request');
      kuzzle.pluginsManager.trigger('log:error', error);
      return callback(error, new ResponseObject(requestObject, error));
    }

    if (!context || !context.connection) {
      error = new PluginImplementationError('Unable to execute request: ' + requestObject +
        '\nReason: invalid context. Use context.getRouter().newConnection() to get a valid context.');
      kuzzle.pluginsManager.trigger('log:error', error);
      return callback(error, new ResponseObject(requestObject, error));
    }

    if (!context.connection.id || !this.connections[context.connection.id]) {
      error = new PluginImplementationError('Unable to execute request: unknown context. ' +
        'Has context.getRouter().newConnection() been called before executing requests?');
      kuzzle.pluginsManager.trigger('log:error', error);
      return callback(error, new ResponseObject(requestObject, error));
    }

    kuzzle.funnel.execute(requestObject, context, callback);
  };

  /**
   * Called by protocol plugins: removes a connection from the connection pool.
   * @param {object} context - connection context, obtained using the newConnection() method
   */
  this.removeConnection = function routerRemoveConnection (context) {
    if (context.connection && context.connection.id && this.connections[context.connection.id]) {
      delete this.connections[context.connection.id];
      kuzzle.hotelClerk.removeCustomerFromAllRooms(context.connection);
      kuzzle.statistics.dropConnection(context.connection);
    }
    else {
      kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError('Unable to remove connection: ' +
        JSON.stringify(context) + '.\nReason: unknown context'));
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
      executeFromRest(kuzzle.funnel, {controller: 'read', action: 'serverInfo'}, data, cb);
    });

    // create and mount a new router for plugins
    kuzzle.pluginsManager.routes.forEach(route => {
      this.router[route.verb](apiPlugin + '/' + route.url, (data, cb) => {
        executeFromRest(kuzzle.funnel, {controller: route.controller, action: route.action}, data, cb);
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
        executeFromRest(kuzzle.funnel, {controller: route.controller, action: route.action}, data, cb);
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
 * @param {object} requestObject - includes URL and POST query data
 * @param {function} cb - callback to invoke with the result
 */
function executeFromRest(funnel, params, requestObject, cb) {
  var
    context = {
      connection: {
        type: 'rest',
        id: ''
      },
      token: null
    };

  requestObject.controller = params.controller;
  requestObject.action = params.action;

  funnel.execute(requestObject, context, (err, res) => {
    var
      indent = 0;

    if (requestObject.data.body && requestObject.data.body.pretty !== undefined) {
      indent = 2;
    }

    /*
     * the funnel controller always return a result, even
      * if an error occured. In that case, the result is
      * the ResponseObject equivalent of the raised error.
     */
    cb(new HttpResponse(res.requestId, 'application/json', res.status, JSON.stringify(res.toJson(), undefined, indent)));
  });
}

/**
 * @type {RouterController}
 */
module.exports = RouterController;
