'use strict';

var
  Promise = require('bluebird'),
  HttpRouter = require('../core/httpRouter'),
  jsonToYaml = require('json2yaml'),
  bodyParser = require('body-parser'),
  finalhandler = require('finalhandler'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require('kuzzle-common-objects').Models.responseObject,
  PluginImplementationError = require('kuzzle-common-objects').Errors.pluginImplementationError,
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  generateSwagger = require('../core/swagger');

const RegexpContentType = /application\/json(; charset=([a-z0-9A-Z\-]*))?/;

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

    kuzzle.funnel.execute(requestObject, context, (err, response) => {
      callback(err, response);
    });
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
  this.initHttpRouter = function routerInitHttpRouter () {
    var
      apiBase = '/api',
      api = apiBase + '/' + kuzzle.config.apiVersion,
      apiPlugin = api + '/_plugin',
      coverage;

    // create and mount a new router for the coverage API
    /*
    if (process.env.FEATURE_COVERAGE === '1') {
      coverage = require('istanbul-middleware');
      this.router.use('/coverage', coverage.createHandler({resetOnGet: true}));
    }
    */

    /*
     Registering the basic _serverInfo route
     This route is also used to get Kuzzle API Version, so it isn't registered under api/<version> but
     directly under api/
     */
    this.router.get(apiBase + '/_serverInfo', (request, response, data) => {
      executeFromRest(kuzzle.funnel, {controller: 'read', action: 'serverInfo'}, response, data);
    });

    // create and mount a new router for plugins
    kuzzle.pluginsManager.routes.forEach(route => {
      this.router[route.verb](apiPlugin + '/' + route.url, (request, response, data) => {
        executeFromRest(kuzzle.funnel, {controller: route.controller, action: route.action}, response, data);
      });
    });

    // add a body parsing middleware to our API
    //api.use(bodyParser.json({limit: kuzzle.config.server.http.maxRequestSize}));

    this.router.get(apiBase + '/swagger.json', (request, response) => {
      generateSwagger(kuzzle)
        .then(swagger => {
          response.setHeader('Access-Control-Allow-Origin', '*');
          response.setHeader('Access-Control-Allow-Headers', 'X-Requested-With');
          response.writeHead(200, {'Content-Type': 'application/json'});
          response.end(JSON.stringify(swagger));
        });
    });

    this.router.get(apiBase + '/swagger.yml', (request, response) => {
      generateSwagger(kuzzle)
        .then(swagger => {
          response.setHeader('Access-Control-Allow-Origin', '*');
          response.setHeader('Access-Control-Allow-Headers', 'X-Requested-With');
          response.writeHead(200, {'Content-Type': 'application/yaml'});
          response.end(jsonToYaml.stringify(swagger));
        });
    });

    // Register API routes
    this.kuzzle.config.httpRoutes.forEach(route => {
      this.router[route.verb](api + route.url, (request, response, data) => {
        executeFromRest(kuzzle.funnel, {controller: route.controller, action: route.action}, response, data);
      });
    });
  };

  /**
   * Forward incoming REST requests to the HTTP routes created by the
   * initHttpRouter function.
   *
   * @param request transmitted through the REST API
   * @param response is the HTTP connection handler
   */
  this.routeHttp = function routerRouteHttp (request, response) {
    this.router.route(request, response);
  };
}

/**
 * Transmit HTTP requests to the funnel controller and forward its response back to
 * the client
 *
 * @param {object} funnel controller
 * @param params contains the request metadata
 * @param response is the HTTP connection handler
 * @param {object} data - url query data - includes POST data
 */
function executeFromRest(funnel, params, response, data) {
  var
    requestObject,
    context = {
      connection: {
        type: 'rest',
        id: ''
      },
      token: null
    };

  data.controller = params.controller;
  data.action = params.action;

  requestObject = new RequestObject(data, {}, 'rest');

  funnel.execute(requestObject, context, (error, responseObject) => {
    response.writeHead(responseObject.status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'X-Requested-With'
    });
    response.end(JSON.stringify(responseObject.toJson()));
  });
}

function contentTypeCheck (request, response, next) {
  var
    errorObject,
    isError = false;

  if (request.headers['content-type']) {
    let match = RegexpContentType.exec(request.headers['content-type']);

    if (match === null) {
      isError = true;
      errorObject = new ResponseObject(request, new BadRequestError('Invalid request content-type. Expected "application/json", got: "' + request.headers['content-type'] + '"'));
    } else if (match[2] !== undefined && match[2].toLowerCase() !== 'utf-8') {
      isError = true;
      errorObject = new ResponseObject(request, new BadRequestError('Charset of the Request content-type must be utf-8. Expected "application/json; charset=utf-8", got: "' + request.headers['content-type'] + '"'));
    }

    if (isError) {
      response.writeHead(errorObject.status, {'Content-Type': 'application/json'});
      response.end(JSON.stringify(errorObject.toJson()));
      return false;
    }
  }

  next && next();

  return true;
}

module.exports = RouterController;
