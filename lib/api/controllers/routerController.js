var
  async = require('async'),
  _ = require('lodash'),
  stringify = require('json-stable-stringify'),
  Router = require('router'),
  bodyParser = require('body-parser'),
  finalhandler = require('finalhandler'),
  RequestObject = require('../core/models/requestObject'),
  ResponseListener = require('../core/responseListener');

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
      response.end(stringify({error: null, result: 'Hello from Kuzzle :)'}));
    });

    api.post('/_bulk', function (request, response) {
      var params = {
        controller: 'bulk',
        action: 'import'
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
    kuzzle.log.silly('Handle HTTP request');
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
      connection = {type: 'websocket', id: socket.id};

    async.each(routerCtrl.controllers, function recordSocketListener (controller) {
      socket.on(controller, function (data) {
        var requestObject = new RequestObject(data, {controller: controller}, 'websocket');

        kuzzle.log.silly('Handle Websocket', controller, 'request');
        kuzzle.router.listener.add(requestObject, connection);

        // Execute the funnel. Forward any non-empty response to the user.
        kuzzle.funnel.execute(requestObject, connection)
          .then(function onExecuteSuccess (responseObject) {
            if (!_.isEmpty(responseObject)) {
              kuzzle.notifier.notify(requestObject.requestId, responseObject.toJson(), connection);
            }
          })
          .catch(function onExecuteError(error) {
            kuzzle.emit(requestObject.controller + ':websocket:funnel:reject', error);
            kuzzle.notifier.notify(requestObject.requestId, {error: error.message, result: null}, connection);
            kuzzle.log.error(error);
          });
      });
    });

    // handles socket disconnections
    socket.on('disconnect', function () {
      kuzzle.emit('websocket:disconnect');
      kuzzle.hotelClerk.removeCustomerFromAllRooms(connection);
    });

    // handles socket crashes
    socket.on('error', function (error) {
      kuzzle.emit('websocket:error', error);
      kuzzle.hotelClerk.removeCustomerFromAllRooms(connection);
      kuzzle.log.error(error);
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
          connection = null,
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
          kuzzle.log.error('Parse error: ', e.message, '\nIncriminated message: ', msg, '\nFaulty content: ', rawContent);
          return false;
        }

        kuzzle.log.silly('Handle MQ input', msg.fields.routingKey, 'message');

        // For MQTT messages, we do not have a replyTo header like with AMQP or STOMP
        // => MQTT client has to send its mqtt client id and subscribe to the topic exchange mqtt.<clientId>
        //    to get feedback from Kuzzle.
        if (msg.properties && msg.properties.replyTo) {
          connection = {type: 'amq', id: data.clientId, replyTo: msg.properties.replyTo};
        }
        else {
          connection = {type: 'mqtt', id: data.clientId, replyTo: 'mqtt.' + data.clientId};
        }

        requestObject = new RequestObject(data, {controller: controller, collection: collection, action: action}, 'mq');

        kuzzle.router.listener.add(requestObject, connection);
        kuzzle.funnel.execute(requestObject, connection)
          .then(function (responseObject) {
            if (!_.isEmpty(responseObject)) {
              kuzzle.notifier.notify(requestObject.requestId, responseObject.toJson(), connection);
            }
          })
          .catch(function (error) {
            kuzzle.emit(requestObject.controller + ':mq:funnel:reject', error);
            kuzzle.notifier.notify(requestObject.requestId, {error: error.message, result: null}, connection);
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
    data,
    connection = {type: 'rest', response: response};

  if (!params.controller) {
    response.writeHead(400, {'Content-Type': 'application/json'});
    response.end(stringify({error: 'The "controller" argument is missing', result: null}));
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

  response.writeHead('Access-Control-Allow-Origin', '*');
  response.writeHead('Access-Control-Allow-Headers', 'X-Requested-With');

  this.router.listener.add(requestObject, connection);

  this.funnel.execute(requestObject)
    .then(function (responseObject) {
      response.writeHead(200, {'Content-Type': 'application/json'});
      if (!_.isEmpty(responseObject)) {
        response.end(stringify(responseObject.toJson()));
      }

    })
    .catch(function (error) {
      this.emit(requestObject.controller + ':websocket:funnel:reject', error);
      response.writeHead(400, {'Content-Type': 'application/json'});
      response.end(stringify({error: error.message, result: null}));
    }.bind(this));
}
