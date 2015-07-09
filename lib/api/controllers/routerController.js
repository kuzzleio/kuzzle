var
// library for execute asynchronous methods
  async = require('async'),
  _ = require('lodash'),
  stringify = require('json-stable-stringify'),
  Router = require('router'),
  q = require('q'),
  // For parse a request sent by user
  bodyParser = require('body-parser'),
  // For final step to respond to HTTP request
  finalhandler = require('finalhandler'),
  RequestObject = require('../core/models/requestObject');

module.exports = function RouterController (kuzzle) {

  this.router = null;
  this.controllers = ['write', 'read', 'subscribe', 'admin', 'bulk'];
  this.kuzzle = kuzzle;

  this.initRouterHttp = function () {

    this.router = new Router();

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
        kuzzle.log.silly('Handle Websocket', controller, 'request');

        var requestObject = new RequestObject(data, {controller: controller});

        // Listen broker because we waiting for writeEngine response
        if (['write', 'admin', 'bulk'].indexOf(requestObject.controller) !== -1) {
          kuzzle.services.list.broker.listen(requestObject.uniqueRoom, function (writeResponse) {
            kuzzle.notifier.notify(requestObject.requestId, writeResponse, connection);
          }, true);
        }

        // execute the funnel. If error occurred, notify users
        kuzzle.funnel.execute(requestObject, connection)
          .then(function onExecuteSuccess (responseObject) {
            // if something is returned we notify the user
            if (!_.isEmpty(responseObject)) {
              kuzzle.notifier.notify(requestObject.requestId, responseObject.toJson(), connection);
            }
          })
          .catch(function onExecuteError(error) {
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
      kuzzle.hotelClerk.removeCustomerFromAllRooms(socket.id);
    });

    // add specific error handler on socket
    socket.on('error', function (error) {
      kuzzle.log.error(error);
    });
  };

  this.routeMQListener = function () {

    async.each(this.controllers, function recordMQListener (controller) {

      kuzzle.services.list.broker.listenExchange(controller+'.*.*', function handleMQMessage(msg) {
        var connectionId = msg.properties.replyTo,
            connection = null,
            data = JSON.parse(msg.content.toString()),
            requestObject,
            routingArray = msg.fields.routingKey.split('.'),
            controller = routingArray[0],
            collection = routingArray[1],
            action = routingArray[2];

        /*
         MQTT messages are encoded as an array of bytes.
         We have to first convert it before using the JSON parser.
          */
        if (!msg.content instanceof Buffer) {
          data = JSON.parse(msg.content.toString());
        }
        else {
          data = JSON.parse((new Buffer(msg.content)).toString());
        }

        kuzzle.log.silly('Handle MQ input', msg.fields.routingKey , 'message');

        // For MQTT messages, we do not have a replyTo header like with AMQP or STOMP
        // => MQTT client has to send its mqtt client id and subscribe to the topic exchange mqtt.<clientId>
        //    to get feedback from Kuzzle.
        if (data.mqttClientId) {
          connectionId = 'mqtt.'+data.mqttClientId;
        }

        if (connectionId) {
          connection = {type: connectionId.split('.')[0], id: connectionId};
        }

        requestObject = new RequestObject(data, {controller: controller, collection: collection, action: action});

        // Listen broker because we waiting for writeEngine response
        if (['write', 'admin', 'bulk'].indexOf(requestObject.controller) !== -1) {
          kuzzle.services.list.broker.listen(requestObject.uniqueRoom, function (writeResponse) {
            kuzzle.notifier.notify(requestObject.requestId, writeResponse, connection);
          }, true);
        }

        kuzzle.funnel.execute(requestObject, connection)
          .then(function onExecuteSuccess (responseObject) {
            // if something is returned we notify the user
            if (!_.isEmpty(responseObject)) {
              kuzzle.notifier.notify(requestObject.requestId, responseObject.toJson(), connection);
            }
          }.bind(this))
          .catch(function onExecuteError(error) {
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
    data;

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

  requestObject = new RequestObject(data, request.body);

  response.writeHead('Access-Control-Allow-Origin', '*');
  response.writeHead('Access-Control-Allow-Headers', 'X-Requested-With');

  // Listen broker because we waiting for writeEngine response
  if (['write', 'admin', 'bulk'].indexOf(requestObject.controller) !== -1) {
    this.services.list.broker.listen(requestObject.uniqueRoom, function (writeResponse) {
      response.end(stringify(writeResponse));
    }.bind(this), true);
  }

  this.funnel.execute(requestObject)
    .then(function (responseObject) {
      response.writeHead(200, {'Content-Type': 'application/json'});

      // if something is returned we notify the user
      if (!_.isEmpty(responseObject)) {
        response.end(stringify(responseObject.toJson()));
      }

    }.bind(this))
    .catch(function (error) {
      response.writeHead(400, {'Content-Type': 'application/json'});
      response.end(stringify({error: error, result: null}));
    });
}
