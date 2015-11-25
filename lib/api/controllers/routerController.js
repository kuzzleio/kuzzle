var
  _ = require('lodash'),
  stringify = require('json-stable-stringify'),
  Router = require('router'),
  bodyParser = require('body-parser'),
  finalhandler = require('finalhandler'),
  RequestObject = require('../core/models/requestObject'),
  ResponseObject = require('../core/models/responseObject'),
  ResponseListener = require('../core/responseListener'),
  BadRequestError = require('../core/errors/badRequestError');

module.exports = function RouterController (kuzzle) {
  this.router = null;
  this.routename = 'kuzzle';
  this.kuzzle = kuzzle;
  this.listener = new ResponseListener(this.kuzzle, this.kuzzle.config.queues.workerWriteResponseQueue);

  /**
   * Initializes the HTTP routes for the Kuzzle REST API.
   */
  this.initRouterHttp = function () {
    var
      api = new Router(),
      coverage,
      routes = [
        {verb: 'get', url: '/_listCollections', controller: 'read', action: 'listCollections'},
        {verb: 'get', url: '/_getLastStats', controller: 'admin', action: 'getLastStats'},
        {verb: 'post', url: '/_getStats', controller: 'admin', action: 'getStats'},
        {verb: 'get', url: '/_getAllStats', controller: 'admin', action: 'getAllStats'},
        {verb: 'get', url: '/_now', controller: 'read', action: 'now'},
        {verb: 'put', url: '/_role', controller: 'admin', action: 'putRole'},
        {verb: 'get', url: '/:collection/_mapping', controller: 'admin', action: 'getMapping'},
        {verb: 'get', url: '/:collection/:id', controller: 'read', action: 'get'},
        {verb: 'post', url: '/_bulk', controller: 'bulk', action: 'import'},
        {verb: 'post', url: '/:collection/_bulk', controller: 'bulk', action: 'import'},
        {verb: 'post', url: '/:collection/_search', controller: 'read', action: 'search'},
        {verb: 'post', url: '/:collection/_count', controller: 'read', action: 'count'},
        {verb: 'post', url: '/:collection', controller: 'write', action: 'create'},
        {verb: 'delete', url: '/:collection/_query', controller: 'write', action: 'deleteByQuery'},
        {verb: 'delete', url: '/:collection/_truncate', controller: 'admin', action: 'truncateCollection'},
        {verb: 'delete', url: '/:collection/:id', controller: 'write', action: 'delete'},
        {verb: 'delete', url: '/:collection', controller: 'admin', action: 'deleteCollection'},
        {verb: 'put', url: '/:collection', controller: 'write', action: 'createCollection'},
        {verb: 'put', url: '/:collection/_mapping', controller: 'admin', action: 'putMapping'},
        {verb: 'put', url: '/:collection/:id/_:action', controller: 'write'},
        {verb: 'put', url: '/:collection/:id', controller: 'write', action: 'createOrUpdate'}
      ];

    this.router = new Router();

    // create and mount a new router for the coverage API
    if (process.env.FEATURE_COVERAGE === '1') {
      coverage = require('istanbul-middleware');
      this.router.use('/coverage', coverage.createHandler({ resetOnGet: true }));
    }

    // create and mount a new router for our API
    this.router.use('/api/', api);

    // add a body parsing middleware to our API
    api.use(bodyParser.json());

    // Simple hello world to let know to the user that kuzzle is running
    api.get('/', function (request, response) {
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
   * Handles requests coming from websocket connections
   *
   * @param {Object} socket client
   */
  this.routeWebsocket = function (socket) {
    var
      routerCtrl = this,
      context = {
        connection: {type: 'websocket', id: socket.id},
        user: null
      };

    kuzzle.statistics.newConnection(context.connection);

    socket.on(routerCtrl.routename, function (data) {
      var
        requestObject;

      requestObject = new RequestObject(data, {}, 'websocket');

      kuzzle.pluginsManager.trigger('log:silly', 'Handle Websocket for controller ' + data.controller);
      kuzzle.router.listener.add(requestObject, context.connection);

      // Execute the funnel. Forward any non-empty response to the user.
      kuzzle.repositories.user.loadFromToken(getBearerTokenFromHeaders(data.headers))
        .then(function (user) {
          context.user = user;

          return kuzzle.funnel.execute(requestObject, context);
        })
        .then(function onExecuteSuccess (responseObject) {
          if (!_.isEmpty(responseObject)) {
            kuzzle.notifier.notify(requestObject.requestId, responseObject.toJson(), context.connection);
          }
        })
        .catch(function onExecuteError(error) {
          var errorObject = new ResponseObject({}, error);
          kuzzle.emit(requestObject.controller + ':websocket:funnel:reject', error);
          kuzzle.pluginsManager.trigger('log:error', error);
          kuzzle.notifier.notify(requestObject.requestId, errorObject.toJson(), context.connection);
        });
    });

    // handles socket disconnections
    socket.on('disconnect', function () {
      kuzzle.pluginsManager.trigger('websocket:disconnect', 'A client is disconnected');
      kuzzle.hotelClerk.removeCustomerFromAllRooms(context.connection);
      kuzzle.statistics.dropConnection(context.connection);
    });

    // handles socket crashes
    socket.on('error', function (error) {
      kuzzle.pluginsManager.trigger('websocket:error', error);
      kuzzle.hotelClerk.removeCustomerFromAllRooms(context.connection);
      kuzzle.statistics.dropConnection(context.connection);
    });
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
        context.connection = {type: 'amq', id: data.clientId, replyTo: msg.properties.replyTo};
      }
      else {
        context.connection = {type: 'mqtt', id: data.clientId, replyTo: 'mqtt.' + data.clientId};
      }

      requestObject = new RequestObject(data, {}, 'mq');

      kuzzle.router.listener.add(requestObject, context.connection);
      kuzzle.repositories.user.loadFromToken(getBearerTokenFromHeaders(data.headers))
        .then(function (user) {
          context.user = user;
          return kuzzle.funnel.execute(requestObject, context);
        })
        .then(function (responseObject) {
          if (!_.isEmpty(responseObject)) {
            kuzzle.notifier.notify(requestObject.requestId, responseObject.toJson(), context.connection);
          }
        })
        .catch(function (error) {
          var errorObject = new ResponseObject({}, error);
          kuzzle.emit(requestObject.controller + ':mq:funnel:reject', error);
          kuzzle.pluginsManager.trigger('log:error', error);
          kuzzle.notifier.notify(requestObject.requestId, errorObject.toJson(), context.connection);
        });
    }); // end listenExchange
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
    context;

  context = {
    connection: {type: 'rest', response: response},
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

  if (request.params.id) {
    data._id = request.params.id;
  }

  requestObject = new RequestObject(data, request.body, 'rest');

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'X-Requested-With');

  this.router.listener.add(requestObject, context.connection);

  this.repositories.user.loadFromToken(getBearerTokenFromHeaders(request.headers))
    .then(function (user) {
      context.user = user;

      return this.funnel.execute(requestObject, context);
    }.bind(this))
    .then(function (responseObject) {
      if (!_.isEmpty(responseObject)) {
        response.writeHead(responseObject.status, {'Content-Type': 'application/json'});
        response.end(stringify(responseObject.toJson()));
      }
      else if (requestObject.controller === 'write' && !requestObject.isPersistent()) {
        response.writeHead(200, {'Content-Type': 'application/json'});
        response.end(stringify(new ResponseObject(requestObject).toJson()));
      }
      else {
        /*
        the controller did not respond with a valid ResponseObject,
        most likely because it deferred its treatment to a worker.
        We keep the connection open to listen to the feedback coming
        from the worker.
        */
      }
    })
    .catch(function (error) {
      errorObject = new ResponseObject({}, error);
      this.emit(requestObject.controller + ':websocket:funnel:reject', error);
      this.pluginsManager.trigger('log:error', error);
      response.writeHead(errorObject.status, {'Content-Type': 'application/json'});
      response.end(stringify(errorObject.toJson()));
    }.bind(this));
}

/**
 * Extract the Bearer token from the given headers
 * @param {Array} headers
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
