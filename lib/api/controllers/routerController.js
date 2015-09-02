var
  async = require('async'),
  _ = require('lodash'),
  stringify = require('json-stable-stringify'),
  Router = require('router'),
  q = require('q'),
  bodyParser = require('body-parser'),
  finalhandler = require('finalhandler'),
  RequestObject = require('../core/models/requestObject'),
  ResponseListener = require('../core/responseListener');

module.exports = function RouterController (kuzzle) {
  this.router = null;
  this.controllers = ['write', 'read', 'subscribe', 'admin', 'bulk'];
  this.kuzzle = kuzzle;
  this.listener = new ResponseListener(this.kuzzle, this.kuzzle.config.queues.workerWriteResponseQueue);


  this.initRouterHttp = function () {
    this.router = new Router();

    if (process.env.FEATURE_COVERAGE == 1) {
      var coverage = require('istanbul-middleware');
      this.router.use('/coverage', coverage.createHandler({ resetOnGet: true }));
    }

    // create and mount a new router for our API
    var api = new Router();
    this.router.use('/api/', api);

    // add a body parsing middleware to our API
    api.use(bodyParser.json());

    // Simple hello world to let know to the user that kuzzle is running
    api.get('/', function (request, response) {
      response.writeHead('Access-Control-Allow-Origin', '*');
      response.writeHead('Access-Control-Allow-Headers', 'X-Requested-With');
      response.writeHead(200, {'Content-Type': 'application/json'});
      response.end(stringify({error: null, result: 'Hello from Kuzzle :)'}));
    }.bind(this));

    api.post('/_bulk', function (request, response) {
      var params = {
        controller: 'bulk',
        action: 'import'
      };

      executeFromRest.call(kuzzle, params, request, response);
    }.bind(this));

    api.post('/:collection/_bulk', function (request, response) {
      var params = {
        controller: 'bulk',
        action: 'import'
      };

      executeFromRest.call(kuzzle, params, request, response);
    }.bind(this));

    api.put('/:collection/_mapping', function (request, response) {
      var params = {
        controller: 'admin',
        action: 'putMapping'
      };

      executeFromRest.call(kuzzle, params, request, response);
    }.bind(this));

    api.get('/:collection/_mapping', function (request, response) {
      var params = {
        controller: 'admin',
        action: 'getMapping'
      };

      executeFromRest.call(kuzzle, params, request, response);
    }.bind(this));

    api.post('/:collection/_search', function (request, response) {
      var params = {
        controller: 'read',
        action: 'search'
      };

      executeFromRest.call(kuzzle, params, request, response);
    }.bind(this));

    api.delete('/:collection/_query', function (request, response) {
      var params = {
        controller: 'write',
        action: 'deleteByQuery'
      };

      executeFromRest.call(kuzzle, params, request, response);
    }.bind(this));

    api.post('/:collection/_count', function (request, response) {
      var params = {
        controller: 'read',
        action: 'count'
      };

      executeFromRest.call(kuzzle, params, request, response);
    }.bind(this));

    api.put('/:collection/:id/_:action', function (request, response) {
      var params = {
        controller: 'write'
      };

      executeFromRest.call(kuzzle, params, request, response);
    }.bind(this));

    api.put('/:collection/:id', function (request, response) {
      var params = {
        controller: 'write',
        action: 'update'
      };

      executeFromRest.call(kuzzle, params, request, response);
    }.bind(this));

    api.post('/:collection', function (request, response) {
      var params = {
        controller: 'write',
        action: 'create'
      };

      executeFromRest.call(kuzzle, params, request, response);
    }.bind(this));

    api.get('/:collection/:id', function (request, response) {
      var params = {
        controller: 'read',
        action: 'get'
      };

      executeFromRest.call(kuzzle, params, request, response);
    }.bind(this));

    api.delete('/:collection/:id', function (request, response) {
      var params = {
        controller: 'write',
        action: 'delete'
      };

      executeFromRest.call(kuzzle, params, request, response);
    }.bind(this));

    api.delete('/:collection', function (request, response) {
      var params = {
        controller: 'admin',
        action: 'deleteCollection'
      };

      executeFromRest.call(kuzzle, params, request, response);
    }.bind(this));

  };

  this.routeHttp = function (request, response) {
    kuzzle.log.silly('Handle HTTP request');
    this.router(request, response, finalhandler(request, response));
  };

  /**
   * Create asynchronously listeners on all rooms defined by this.controllers
   *
   * @param {Object} socket
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
            if (_.isObject(error)) {
              error = error.toString();
            }

            kuzzle.notifier.notify(requestObject.requestId, {error: error, result: null}, connection);
            kuzzle.log.error(error);
          });
      });
    });

    // add a specific disconnect event for websocket
    socket.on('disconnect', function () {
      kuzzle.emit('websocket:disconnect');
      kuzzle.hotelClerk.removeCustomerFromAllRooms(connection);
    });

    // add specific error handler on socket
    socket.on('error', function (error) {
      kuzzle.emit('websocket:error',error);
      kuzzle.log.error(error);
    });
  };

  /**
   * Listens to queries passed using a MQ protocol: AMQP, STOMP, MQTT
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
          controller = routingArray[0],
          collection = routingArray[1],
          action = routingArray[2];

        if (!msg.content instanceof Buffer) {
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
          }.bind(this))
          .catch(function (error) {
            kuzzle.emit(requestObject.controller + ':mq:funnel:reject', error);
            kuzzle.notifier.notify(requestObject.requestId, {error: error, result: null}, connection);
          });
      }); // end listenExchange
    }); // end async
  };
};

function executeFromRest(params, request, response) {
  var
    deferred = q.defer(),
    requestObject,
    data,
    connection = {type: 'rest', response: response};

  if (!params.controller) {
    deferred.reject('Missing controller');
    return deferred.promise;
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

    }.bind(this))
    .catch(function (error) {
      this.emit(requestObject.controller + ':websocket:funnel:reject', error);
      response.writeHead(400, {'Content-Type': 'application/json'});
      response.end(stringify({error: error, result: null}));
    }.bind(this));
}
