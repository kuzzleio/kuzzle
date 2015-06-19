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
  // Used for hash into md5 the data for generate a requestId
  crypto = require('crypto');


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

    api.post('/_bulk', function (request, response) {
      var params = {
        controller: 'bulk',
        action: 'import'
      };

      executeFromRest.call(this, params, request, response);
    }.bind(this));

    api.post('/:collection/_bulk', function (request, response) {
      var params = {
        controller: 'bulk',
        action: 'import'
      };

      executeFromRest.call(this, params, request, response);
    }.bind(this));

    api.put('/:collection/_mapping', function (request, response) {
      var params = {
        controller: 'admin',
        action: 'putMapping'
      };

      executeFromRest.call(this, params, request, response);
    }.bind(this));

    api.get('/:collection/_mapping', function (request, response) {
      var params = {
        controller: 'admin',
        action: 'getMapping'
      };

      executeFromRest.call(this, params, request, response);
    }.bind(this));

    api.post('/:collection/_search', function (request, response) {
      var params = {
        controller: 'read',
        action: 'search'
      };

      executeFromRest.call(this, params, request, response);
    }.bind(this));

    api.delete('/:collection/_query', function (request, response) {
      var params = {
        controller: 'write',
        action: 'deleteByQuery'
      };

      executeFromRest.call(this, params, request, response);
    }.bind(this));

    api.put('/:collection/:id/_:action', function (request, response) {
      var params = {
        controller: 'write'
      };

      executeFromRest.call(this, params, request, response);
    }.bind(this));

    api.put('/:collection/:id', function (request, response) {
      var params = {
        controller: 'write',
        action: 'update'
      };

      executeFromRest.call(this, params, request, response);
    }.bind(this));

    api.post('/:collection', function (request, response) {
      var params = {
        controller: 'write',
        action: 'create'
      };

      executeFromRest.call(this, params, request, response);
    }.bind(this));

    api.get('/:collection/:id', function (request, response) {
      var params = {
        controller: 'read',
        action: 'get'
      };

      executeFromRest.call(this, params, request, response);
    }.bind(this));

    api.delete('/:collection/:id', function (request, response) {
      var params = {
        controller: 'write',
        action: 'delete'
      };

      executeFromRest.call(this, params, request, response);
    }.bind(this));

    api.delete('/:collection', function (request, response) {
      var params = {
        controller: 'admin',
        action: 'deleteCollection'
      };

      executeFromRest.call(this, params, request, response);
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
        data = wrapObject(data, {controller: controller});

        var requestId = data.requestId;

        // execute the funnel. If error occurred, notify users
        kuzzle.funnel.execute(data, connection)
          .then(function onExecuteSuccess (result) {
            kuzzle.notifier.notify(result.rooms, result.data);
            kuzzle.notifier.notify(requestId, {error: null, result: result.data}, connection);
          })
          .catch(function onExecuteError(error) {
            kuzzle.notifier.notify(requestId, {error: error, result: null}, connection);
            kuzzle.log.verbose({error: error});
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
            routingArray = msg.fields.routingKey.split('.'),
            controller = routingArray[0],
            collection = routingArray[1],
            action = routingArray[2];

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

        var requestId = data.requestId || connectionId;

        data = wrapObject(data, {controller: controller, collection: collection, action: action});

        kuzzle.funnel.execute(data, connection)
          .then(function onExecuteSuccess (result) {
            kuzzle.notifier.notify(result.rooms, result.data);
            kuzzle.notifier.notify(requestId, {error: null, result: result.data}, connection);
          }.bind(this))
          .catch(function onExecuteError(error) {
            kuzzle.notifier.notify(requestId, {error: error, result: null}, connection);
            kuzzle.log.verbose({error: error});
          });

      }); // end listenExchange

    }); // end async
  };
};

function sendRestError(error, response) {
  response.writeHead(400, {'Content-Type': 'application/json'});
  response.end(stringify({error: error, result: null}));

  return false;
}

function executeFromRest(params, request, response) {
  var
    deferred = q.defer(),
    data,
    uuid = require('node-uuid').v1();

  if (!params.controller) {
    deferred.reject('Missing controller');
    return deferred.promise;
  }

  data = {
    controller: params.controller,
    action: params.action || request.params.action,
    collection: request.params.collection,
    _id: request.params.id
  };

  data = wrapObject(request.body, data);

  data.connectionId = uuid;

  this.kuzzle.services.list.broker.listen('write_response_'+uuid, function (result) {
    response.end(stringify(result));
  });

  this.kuzzle.funnel.execute(data)
    .then(function (result) {
      response.writeHead(200, {'Content-Type': 'application/json'});

      // if have an empty result, we have to listen a queue for get writeEngine action
      if (data.persist && _.isEmpty(result)) {

      }
      else {
        response.end(stringify({error: null, result: result.data}));
      }

    }.bind(this))
    .catch(function (error) {
      return sendRestError(error, response);
    });
}

function wrapObject (requestBody, data) {
  // if the action or controller are directly in request sent by client (for websocket/MQTT...)
  if (requestBody.action || requestBody.controller) {
    data = _.extend(data, requestBody);
  }

  if (data.body === undefined) {
    data.body = requestBody.body || requestBody;
  }

  if (requestBody.persist !== undefined) {
    data.persist = requestBody.persist;
  }
  if (data.persist === undefined) {
    data.persist = true;
  }

  // The request Id is optional, but we have to generate it if the user
  // not provide it. We need to return this id for let the user know
  // how to get real time information about his data
  if (!data.requestId) {
    var stringifyObject = stringify(data);
    data.requestId = crypto.createHash('md5').update(stringifyObject).digest('hex');
  }

  return data;
}
