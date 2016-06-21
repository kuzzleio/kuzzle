var
  _ = require('lodash'),
  q = require('q'),
  url = require('url'),
  stringify = require('json-stable-stringify'),
  jsonToYaml = require('json2yaml'),
  Router = require('router'),
  bodyParser = require('body-parser'),
  finalhandler = require('finalhandler'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require('kuzzle-common-objects').Models.responseObject,
  PluginImplementationError = require('kuzzle-common-objects').Errors.pluginImplementationError,
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  generateSwagger = require('../core/swagger'),
  routes;

/**
 * @property action
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function RouterController (kuzzle) {
  this.router = null;
  this.pluginRouter = null;
  this.routename = 'kuzzle';
  this.kuzzle = kuzzle;
  this.connections = {};

  /**
   * Declares a new connection on a given protocol. Called by protocol plugins.
   * Returns a context object to be used with router.execute() and router.removeConnection()
   *
   * @param {string} protocol - protocol name
   * @param {string} connectionId - unique connection identifier
   * @return {promise} connection context, to be used with other router functions
   */
  this.newConnection = function (protocol, connectionId) {
    var error;

    if (!connectionId || !protocol || typeof connectionId !== 'string' || typeof protocol !== 'string') {
      error = new PluginImplementationError('Rejected new connection declaration: invalid arguments');
      kuzzle.pluginsManager.trigger('log:error', error);
      return q.reject(error);
    }

    if (!this.connections[connectionId]) {
      this.connections[connectionId] = {
        connection: {type: protocol, id: connectionId},
        token: null
      };
    }

    kuzzle.statistics.newConnection(this.connections[connectionId]);

    return q(this.connections[connectionId]);
  };

  /**
   * Called by protocol plugins: forward a received request to Kuzzle.
   * Resolves a callback with the corresponding controller response
   *
   * A note about the JWT headers: if this value is falsey, if no "authorization" field is found, if the token is not
   * properly formatted or if the token itself is invalid, then the corresponding user will automatically
   * be set to "anonymous".
   *
   * @param {Object} requestObject - the request to execute
   * @param {{connection: {id: String}}} context - connection context, obtained using the newConnection() method
   * @param {Function} callback
   * @return {Promise} ResponseObject
   */
  this.execute = function (requestObject, context, callback) {
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
  this.removeConnection = function (context) {
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
  this.initRouterHttp = function () {
    var
      apiBase = new Router(),
      api = new Router(),
      apiPlugin = new Router(),
      handleRoute,
      extractRouteInfo,
      coverage;

    routes = kuzzle.config.httpRoutes;

    this.router = new Router();

    this.router.use(contentTypeCheck);

    // create and mount a new router for the coverage API
    if (process.env.FEATURE_COVERAGE === '1') {
      coverage = require('istanbul-middleware');
      this.router.use('/coverage', coverage.createHandler({resetOnGet: true}));
    }

    // create and mount a new router for our API
    this.router.use('/api', apiBase);
    this.router.use('/api/' + kuzzle.config.apiVersion, api);

    extractRouteInfo = function (infos, routeList, prefix) {
      if (!prefix) {
        prefix = '';
      }

      routeList.forEach((route) => {
        if (infos[route.controller] === undefined) {
          infos[route.controller] = {};
        }
        if (infos[route.controller][route.verb] === undefined) {
          infos[route.controller][route.verb] = [];
        }
        infos[route.controller][route.verb].push('/api' + prefix + route.url);
      });
    };

    /**
     * @this {RouterController}
     * @param request
     * @param response
     */
    handleRoute = function(request, response) {
      var params = {
        controller: this.controller
      };

      if (this.action) {
        params.action = this.action;
      }

      if (!request.hasOwnProperty('body')) {
        request.body = {};
      }

      executeFromRest.call(kuzzle, params, request, response);
    };

    /*
     Registering the basic _serverInfo route
     This route is also used to get Kuzzle API Version, so it isn't registered under api/<version> but
     directly under api/
     */
    apiBase.get('/_serverInfo', (request, response) => {
      executeFromRest.call(kuzzle, {controller: 'read', action: 'serverInfo'}, request, response);
    });

    // create and mount a new router for plugins
    api.use('/_plugin', apiPlugin);

    kuzzle.pluginsManager.routes.forEach(route => {
      apiPlugin[route.verb](route.url, handleRoute.bind(route));
    });

    // add a body parsing middleware to our API
    api.use(bodyParser.json());

    // Simple hello world to let know to the user that kuzzle is running
    api.get('/', (request, response) => {
      var _routes = {};

      extractRouteInfo(_routes, routes, '/' + kuzzle.config.apiVersion);
      extractRouteInfo(_routes, [{verb: 'get', url: '/_serverInfo', controller: 'read', action: 'serverInfo'}]);
      extractRouteInfo(_routes, kuzzle.pluginsManager.routes, '/' + kuzzle.config.apiVersion + '/_plugin');

      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Allow-Headers', 'X-Requested-With');
      response.writeHead(200, {'Content-Type': 'application/json'});
      response.end(stringify({status: 200, error: null, result: {message: 'Available routes for this API version by verb.', routes: _routes}}));
    });

    apiBase.get('/swagger.json', (request, response) => {
      generateSwagger(kuzzle)
        .then(swagger => {
          response.setHeader('Access-Control-Allow-Origin', '*');
          response.setHeader('Access-Control-Allow-Headers', 'X-Requested-With');
          response.writeHead(200, {'Content-Type': 'application/json'});
          response.end(JSON.stringify(swagger));
        });
    });

    apiBase.get('/swagger.yml', (request, response) => {
      generateSwagger(kuzzle)
        .then(swagger => {
          response.setHeader('Access-Control-Allow-Origin', '*');
          response.setHeader('Access-Control-Allow-Headers', 'X-Requested-With');
          response.writeHead(200, {'Content-Type': 'application/yaml'});
          response.end(jsonToYaml.stringify(swagger));
        });
    });

    // Register API routes
    routes.forEach(route => {
      api[route.verb](route.url, handleRoute.bind(route));
    });
  };

  /**
   * Forward incoming REST requests to the HTTP routes created by the
   * initRouterHttp function.
   *
   * @param request transmitted through the REST API
   * @param response is the HTTP connection handler
   */
  this.routeHttp = function (request, response) {
    kuzzle.pluginsManager.trigger('log:silly', 'Handle HTTP request');

    this.router(request, response, finalhandler(request, response));
  };

  /**
   * Handles requests coming from MQ protocols: AMQP, MQTT & STOMP
   *
   */
  this.routeMQListener = function () {
    kuzzle.services.list.mqBroker.listenExchange(this.routename, function handleMQMessage(msg) {
      var
        context = {
          connection: null,
          user: null
        },
        data,
        requestObject,
        rawContent;

      if (!(msg.content instanceof Buffer)) {
        rawContent = msg.content.toString();
      }
      else {
        rawContent = (new Buffer(msg.content)).toString();
      }

      try {
        data = JSON.parse(rawContent);
      }
      catch (e) {
        kuzzle.pluginsManager.trigger('log:error', {message: 'Parse error', error: e});
        return false;
      }

      kuzzle.pluginsManager.trigger('log:silly', 'Handle MQ input' + msg.fields.routingKey);

      // For MQTT messages, we do not have a replyTo header like with AMQP or STOMP
      // => MQTT client has to send its mqtt client id and subscribe to the topic exchange mqtt.<clientId>
      //    to get feedback from Kuzzle.
      if (msg.properties && msg.properties.replyTo) {
        context.connection = {type: 'amq', id: data.clientId};
      }
      else {
        context.connection = {type: 'mqtt', id: data.clientId};
      }

      requestObject = new RequestObject(data, {}, 'mq');

      kuzzle.funnel.execute(requestObject, context, (error, responseObject) => {
        if (context.connection.type === 'amq') {
          kuzzle.services.list.mqBroker.replyTo(msg.properties.replyTo, responseObject.toJson());
        }
        else {
          kuzzle.services.list.mqBroker.addExchange('mqtt.' + context.connection.id, responseObject.toJson());
        }
      });
    });
  };
}

/**
 * Transmit HTTP requests to the funnel controller and forward its response back to
 * the client
 *
 * @this {Kuzzle}
 * @param params contains the request metadata
 * @param request is the original request from the client
 * @param response is the HTTP connection handler
 */
function executeFromRest(params, request, response) {
  var
    requestObject,
    errorObject,
    data,
    queryParams,
    additionalData,
    context = {
      connection: {
        type: 'rest',
        id: ''
      },
      token: null
    };

  if (!params.controller) {
    errorObject = new ResponseObject(request, new BadRequestError('The "controller" argument is missing'));
    response.writeHead(errorObject.status, {'Content-Type': 'application/json'});
    response.end(stringify(errorObject.toJson()));
    return false;
  }

  if (!contentTypeCheck(request, response)) {
    return false;
  }

  data = {
    controller: params.controller,
    action: params.action || request.params.action,
    collection: request.params.collection,
    headers: request.headers
  };

  if (request.params.action) {
    delete request.params.action;
  }
  if (request.params.collection) {
    delete request.params.collection;
  }
  if (request.params.id) {
    data._id = request.params.id;
    delete request.params.id;
  }

  if (request.params.index) {
    data.index = request.params.index;
    delete request.params.index;
  }

  _.forEach(request.params, function (value, param) {
    request.body[param] = value;
  });

  queryParams = url.parse(request.originalUrl, true);
  additionalData = _.merge(request.body, queryParams.query);
  requestObject = new RequestObject(data, additionalData, 'rest');

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'X-Requested-With');

  this.funnel.execute(requestObject, context, (error, responseObject) => {
    response.writeHead(responseObject.status, {'Content-Type': 'application/json'});
    response.end(stringify(responseObject.toJson()));
  });
}

function contentTypeCheck (request, response, next) {
  var
    errorObject,
    isError = false,
    match = /application\/json(; charset=([a-z0-9A-Z\-]*))?/.exec(request.headers['content-type']);

  next = next || function () {};

  if (request.headers['content-type']) {
    if (match === null) {
      isError = true;
      errorObject = new ResponseObject(request, new BadRequestError('Invalid request content-type. Expected "application/json", got: "' + request.headers['content-type'] + '"'));
    } else if (match[2] !== undefined && match[2].toLowerCase() !== 'utf-8') {
      isError = true;
      errorObject = new ResponseObject(request, new BadRequestError('Charset of the Request content-type must be utf-8. Expected "application/json; charset=utf-8", got: "' + request.headers['content-type'] + '"'));
    }

    if (isError) {
      response.writeHead(errorObject.status, {'Content-Type': 'application/json'});
      response.end(stringify(errorObject.toJson()));
      return false;
    }
  }
  next();
  return true;
}

module.exports = RouterController;
