var
  async = require('async'),
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
  this.controllers = ['write', 'read', 'subscribe', 'admin', 'bulk'];
  this.kuzzle = kuzzle;
  this.listener = new ResponseListener(this.kuzzle, this.kuzzle.config.queues.workerWriteResponseQueue);

  /**
   * Initializes the HTTP routes for the Kuzzle REST API.
   */
  this.initRouterHttp = function () {
    var
      api = new Router(),
      coverage;

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

    api.post('/_bulk', function (request, response) {
      var params = {
        controller: 'bulk',
        action: 'import'
      };

      executeFromRest.call(kuzzle, params, request, response);
    });

    api.post('/_getStats', function (request, response) {
      var params = {
        controller: 'admin',
        action: 'getStats'
      };

      executeFromRest.call(kuzzle, params, request, response);
    });

    api.get('/_getLastStat', function(request, response) {
      var params = {
        controller: 'admin',
        action: 'getLastStat'
      };

      executeFromRest.call(kuzzle, params, request, response);
    });

    api.get('/_getAllStats', function (request, response) {
      var params = {
        controller: 'admin',
        action: 'getAllStats'
      };

      executeFromRest.call(kuzzle, params, request, response);
    });

    api.get('/_listCollections', function (request, response) {
      var params = {
        controller: 'read',
        action: 'listCollections'
      };

      executeFromRest.call(kuzzle, params, request, response);
    });

    api.get('/_now', function (request, response) {
      var params = {
        controller: 'read',
        action: 'now'
      };

      executeFromRest.call(kuzzle, params, request, response);
    });

    api.post('/:collection/_bulk', function (request, response) {
      var params = {
        controller: 'bulk',
        action: 'import'
      };

      executeFromRest.call(kuzzle, params, request, response);
    });

    api.put('/:collection/_mapping', function (request, response) {
      var params = {
        controller: 'admin',
        action: 'putMapping'
      };

      executeFromRest.call(kuzzle, params, request, response);
    });

    api.get('/:collection/_mapping', function (request, response) {
      var params = {
        controller: 'admin',
        action: 'getMapping'
      };

      executeFromRest.call(kuzzle, params, request, response);
    });

    api.post('/:collection/_search', function (request, response) {
      var params = {
        controller: 'read',
        action: 'search'
      };

      executeFromRest.call(kuzzle, params, request, response);
    });

    api.delete('/:collection/_query', function (request, response) {
      var params = {
        controller: 'write',
        action: 'deleteByQuery'
      };

      executeFromRest.call(kuzzle, params, request, response);
    });

    api.post('/:collection/_count', function (request, response) {
      var params = {
        controller: 'read',
        action: 'count'
      };

      executeFromRest.call(kuzzle, params, request, response);
    });

    api.put('/:collection/:id/_:action', function (request, response) {
      var params = {
        controller: 'write'
      };

      executeFromRest.call(kuzzle, params, request, response);
    });

    api.put('/:collection/:id', function (request, response) {
      var params = {
        controller: 'write',
        action: 'createOrUpdate'
      };

      executeFromRest.call(kuzzle, params, request, response);
    });

    api.post('/:collection', function (request, response) {
      var params = {
        controller: 'write',
        action: 'create'
      };

      executeFromRest.call(kuzzle, params, request, response);
    });

    api.get('/:collection/:id', function (request, response) {
      var params = {
        controller: 'read',
        action: 'get'
      };

      executeFromRest.call(kuzzle, params, request, response);
    });

    api.delete('/:collection/:id', function (request, response) {
      var params = {
        controller: 'write',
        action: 'delete'
      };

      executeFromRest.call(kuzzle, params, request, response);
    });

    api.delete('/:collection', function (request, response) {
      var params = {
        controller: 'admin',
        action: 'deleteCollection'
      };

      executeFromRest.call(kuzzle, params, request, response);
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

    async.each(routerCtrl.controllers, function recordSocketListener (controller) {
      socket.on(controller, function (data) {
        var
          requestObject;

        requestObject = new RequestObject(data, {controller: controller}, 'websocket');

        kuzzle.pluginsManager.trigger('log:silly', 'Handle Websocket for controller ' + controller);
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
    async.each(this.controllers, function recordMQListener (controller) {
      kuzzle.services.list.mqBroker.listenExchange(controller+'.*.*', function handleMQMessage(msg) {
        var
          context = {
            connection: null,
            user: null
          },
          data,
          requestObject,
          rawContent,
          routingArray = msg.fields.routingKey.split('.'),
          // routingArray[0] is the controller, which we already have in the 'controller' variable
          collection = routingArray[1],
          action = routingArray[2];

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

        requestObject = new RequestObject(data, {controller: controller, collection: collection, action: action}, 'mq');

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
    }); // end async
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
