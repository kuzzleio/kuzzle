var
  _ = require('lodash'),
  q = require('q'),
  url = require('url'),
  stringify = require('json-stable-stringify'),
  Router = require('router'),
  bodyParser = require('body-parser'),
  finalhandler = require('finalhandler'),
  RequestObject = require('../core/models/requestObject'),
  ResponseObject = require('../core/models/responseObject'),
  PluginImplementationError = require('../core/errors/pluginImplementationError'),
  BadRequestError = require('../core/errors/badRequestError');

module.exports = function RouterController (kuzzle) {
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
        user: null
      };
    }

    kuzzle.statistics.newConnection(this.connections[connectionId]);

    return q(this.connections[connectionId]);
  };

  /**
   * Called by protocol plugins: forward a received request to Kuzzle.
   * Return a promise resolved or rejected with the corresponding ResponseObject
   *
   * A note about the JWT headers: if this value is falsey, if no "authorization" field is found, if the token is not
   * properly formatted or if the token itself is invalid, then the corresponding user will automatically
   * be set to "anonymous".
   *
   * @param {Object} jwtHeaders - Optional JWT headers
   * @param {Object} requestObject - the request to execute
   * @param {String} context - connection context, obtained using the newConnection() method
   * @return {Promise} ResponseObject
   */
  this.execute = function (jwtHeaders, requestObject, context) {
    var error;

    if (!requestObject) {
      error = new PluginImplementationError('Request execution error: no provided request');
      kuzzle.pluginsManager.trigger('log:error', error);
      return q.reject(new ResponseObject({}, error));
    }

    if (!context || !context.connection) {
      error = new PluginImplementationError('Unable to execute request: ' + requestObject +
        '\nReason: invalid context. Use context.getRouter().newConnection() to get a valid context.');
      kuzzle.pluginsManager.trigger('log:error', error);
      return q.reject(new ResponseObject({}, error));
    }

    if (!context.connection.id || !this.connections[context.connection.id]) {
      error = new PluginImplementationError('Unable to execute request: unknown context. ' +
        'Has context.getRouter().newConnection() been called before executing requests?');
      kuzzle.pluginsManager.trigger('log:error', error);
      return q.reject(new ResponseObject({}, error));
    }

    return kuzzle.repositories.user.loadFromToken(getBearerTokenFromHeaders(jwtHeaders))
      .then(user => {
        context.user = user;

        return kuzzle.funnel.execute(requestObject, context);
      })
      .then(response => {
        return response;
      })
      .catch(e => {
        kuzzle.pluginsManager.trigger('log:error', e);
        return q.reject(new ResponseObject({}, e));
      });
  };

  /**
   * Called by protocol plugins: removes a connection from the connection pool.
   * @param {object} context - connection context, obtained using the newConnection() method
   */
  this.removeConnection = function (context) {
    if (context.connection.id && this.connections[context.connection.id]) {
      delete this.connections[context.connection.id];
      kuzzle.hotelClerk.removeCustomerFromAllRooms(context.connection);
      kuzzle.statistics.dropConnection(context.connection);
    }
    else {
      kuzzle.pluginsManager.trigger('log:error', new PluginImplementationError('Unable to remove connection: ' +
        context + '.\nReason: unknown context'));
    }
  };

  /**
   * Initializes the HTTP routes for the Kuzzle REST API.
   */
  this.initRouterHttp = function () {
    var
      apiBase = new Router(),
      api = new Router(),
      coverage,
      routes = [
        {verb: 'get', url: '/_getLastStats', controller: 'admin', action: 'getLastStats'},
        {verb: 'get', url: '/_getAllStats', controller: 'admin', action: 'getAllStats'},
        {verb: 'get', url: '/_login/:strategy', controller: 'auth', action: 'login'},
        {verb: 'get', url: '/_now', controller: 'read', action: 'now'},
        {verb: 'get', url: '/_listIndexes', controller: 'read', action: 'listIndexes'},
        {verb: 'get', url: '/_listSubscriptions', controller: 'subscribe', action: 'list'},
        {verb: 'get', url: '/roles/:id', controller: 'security', action: 'getRole'},
        {verb: 'get', url: '/profiles/:id', controller: 'security', action: 'getProfile'},
        {verb: 'get', url: '/:index/_listCollections', controller: 'read', action: 'listCollections'},
        {verb: 'get', url: '/:index/_listCollections/:type', controller: 'read', action: 'listCollections'},
        {verb: 'get', url: '/:index/:collection/_mapping', controller: 'admin', action: 'getMapping'},
        {verb: 'get', url: '/:index/:collection/:id', controller: 'read', action: 'get'},

        {verb: 'post', url: '/_bulk', controller: 'bulk', action: 'import'},
        {verb: 'post', url: '/_getStats', controller: 'admin', action: 'getStats'},
        {verb: 'post', url: '/roles/_search', controller: 'security', action: 'searchRoles'},
        {verb: 'post', url: '/profiles/_search', controller: 'security', action: 'searchProfiles'},
        {verb: 'post', url: '/_login', controller: 'auth', action: 'login'},
        {verb: 'post', url: '/_login/:strategy', controller: 'auth', action: 'login'},
        {verb: 'post', url: '/:index/_bulk', controller: 'bulk', action: 'import'},
        {verb: 'post', url: '/:index/:collection/_bulk', controller: 'bulk', action: 'import'},
        {verb: 'post', url: '/:index/:collection/_search', controller: 'read', action: 'search'},
        {verb: 'post', url: '/:index/:collection/_count', controller: 'read', action: 'count'},
        {verb: 'post', url: '/:index/:collection/_create', controller: 'write', action: 'create'},
        {verb: 'post', url: '/:index/:collection', controller: 'write', action: 'publish'},

        {verb: 'delete', url: '/_deleteIndexes', controller: 'admin', action: 'deleteIndexes'},
        {verb: 'delete', url: '/roles/:id', controller: 'security', action: 'deleteRole'},
        {verb: 'delete', url: '/profiles/:id', controller: 'security', action: 'deleteProfile'},
        {verb: 'delete', url: '/:index', controller: 'admin', action: 'deleteIndex'},
        {verb: 'delete', url: '/:index/:collection/_query', controller: 'write', action: 'deleteByQuery'},
        {verb: 'delete', url: '/:index/:collection/_truncate', controller: 'admin', action: 'truncateCollection'},
        {verb: 'delete', url: '/:index/:collection/:id', controller: 'write', action: 'delete'},
        {verb: 'delete', url: '/:index/:collection', controller: 'admin', action: 'deleteCollection'},

        {verb: 'put', url: '/roles/:id', controller: 'security', action: 'putRole'},
        {verb: 'put', url: '/profiles/:id', controller: 'security', action: 'putProfile'},
        {verb: 'put', url: '/:index', controller: 'admin', action: 'createIndex'},
        {verb: 'put', url: '/:index/:collection', controller: 'write', action: 'createCollection'},
        {verb: 'put', url: '/:index/:collection/_mapping', controller: 'admin', action: 'putMapping'},
        {verb: 'put', url: '/:index/:collection/:id/_:action', controller: 'write'},
        {verb: 'put', url: '/:index/:collection/:id', controller: 'write', action: 'createOrUpdate'}
      ];
    routes = routes.concat(kuzzle.pluginsManager.routes);

    this.router = new Router();

    // create and mount a new router for the coverage API
    if (process.env.FEATURE_COVERAGE === '1') {
      coverage = require('istanbul-middleware');
      this.router.use('/coverage', coverage.createHandler({ resetOnGet: true }));
    }

    // create and mount a new router for our API
    this.router.use('/api', apiBase);
    this.router.use('/api/' + kuzzle.config.apiVersion, api);

    /*
     Registering the basic _serverInfo route
     This route is also used to get Kuzzle API Version, so it isn't registered under api/<version> but
     directly under api/
     */
    apiBase.get('/_serverInfo', (request, response) => {
      executeFromRest.call(kuzzle, {controller: 'read', action: 'serverInfo'}, request, response);
    });

    // create and mount a new router for plugins
    this.pluginRouter = new Router();
    api.use('/_plugin', this.pluginRouter);

    // add a body parsing middleware to our API
    api.use(bodyParser.json());

    // Simple hello world to let know to the user that kuzzle is running
    api.get('/', (request, response) => {
      response.writeHead('Access-Control-Allow-Origin', '*');
      response.writeHead('Access-Control-Allow-Headers', 'X-Requested-With');
      response.writeHead(200, {'Content-Type': 'application/json'});
      response.end(stringify({status: 200, error: null, result: 'Hello from Kuzzle :)'}));
    });

    // Register API routes
    routes.forEach(route => {
      api[route.verb](route.url, function (request, response) {
        var params = {
          controller: route.controller
        };

        if (route.action) {
          params.action = route.action;
        }

        executeFromRest.call(kuzzle, params, request, response);
      });
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

      kuzzle.repositories.user.loadFromToken(getBearerTokenFromHeaders(data.headers))
        .then(function (user) {
          context.user = user;
          return kuzzle.funnel.execute(requestObject, context);
        })
        .then(function (responseObject) {
          if (context.connection.type === 'amq') {
            kuzzle.services.list.mqBroker.replyTo(msg.properties.replyTo, responseObject.toJson());
          }
          else {
            kuzzle.services.list.mqBroker.addExchange('mqtt.' + context.connection.id, responseObject.toJson());
          }
        })
        .catch(function (error) {
          var errorObject = new ResponseObject({}, error);
          kuzzle.pluginsManager.trigger('log:error', error);
          if (context.connection.type === 'amq') {
            kuzzle.services.list.mqBroker.replyTo(msg.properties.replyTo, errorObject.toJson());
          }
          else {
            kuzzle.services.list.mqBroker.addExchange('mqtt.' + context.connection.id, errorObject.toJson());
          }
        });
    });
  };

};

/**
 * Transmit HTTP requests to the funnel controller and forward its response back to
 * the client
 *
 * @param params contains the request metadata
 * @param request is the original request from the client
 * @param response is the HTTP connection handler
 */
function executeFromRest(params, request, response) {
  var
    requestObject,
    errorObject,
    data,
    additionalData,
    queryParams = {},
    context = {
      connection: {type: 'rest'},
      user: null
    };

  if (!params.controller) {
    errorObject = new ResponseObject({}, new BadRequestError('The "controller" argument is missing'));
    response.writeHead(errorObject.status, {'Content-Type': 'application/json'});
    response.end(stringify(errorObject.toJson()));
    return false;
  }

  if (request.headers['content-type'] && request.headers['content-type'] !== 'application/json') {
    errorObject = new ResponseObject({}, new BadRequestError('Invalid request content-type. Expected "application/json", got: "' + request.headers['content-type'] +'"'));
    response.writeHead(errorObject.status, {'Content-Type': 'application/json'});
    response.end(stringify(errorObject.toJson()));
    return false;
  }

  data = {
    controller: params.controller,
    action: params.action || request.params.action,
    collection: request.params.collection
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

  this.repositories.user.loadFromToken(getBearerTokenFromHeaders(request.headers))
    .then(function (user) {
      context.user = user;

      return this.funnel.execute(requestObject, context);
    }.bind(this))
    .then(function (responseObject) {
      response.writeHead(responseObject.status, {'Content-Type': 'application/json'});
      response.end(stringify(responseObject.toJson()));
    })
    .catch(function (error) {
      errorObject = new ResponseObject(requestObject, error);
      this.emit(requestObject.controller + ':websocket:funnel:reject', error);
      this.pluginsManager.trigger('log:error', error);
      response.writeHead(errorObject.status, {'Content-Type': 'application/json'});
      response.end(stringify(errorObject.toJson()));
    }.bind(this));
}

/**
 * Extract the Bearer token from the given headers
 * @param {Object} headers
 * @returns {*}
 */
function getBearerTokenFromHeaders (headers) {
  var
    r;

  if (headers !== undefined && headers.authorization !== undefined) {
    r = /^Bearer (.+)$/.exec(headers.authorization);
    if (r !== null && r[1].trim() !== '') {
      return r[1].trim();
    }
  }

  return null;
}
