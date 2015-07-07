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
  uuid = require('node-uuid'),
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
        data = wrapObject(data, {controller: controller});

        var requestId = data.requestId;

        // Listen broker because we waiting for writeEngine response
        if (['write', 'admin', 'bulk'].indexOf(data.controller) !== -1) {
          // Add an internal ID into data in order to notify later the same user with the response from writeEngine
          data.internalId = uuid.v1();

          kuzzle.services.list.broker.listen('write_response_' + data.internalId, function (writeResponse) {
            kuzzle.notifier.notify(requestId, kuzzle.tools.cleanProperties(writeResponse), connection);
          });

        }

        // execute the funnel. If error occurred, notify users
        kuzzle.funnel.execute(data, connection)
          .then(function onExecuteSuccess (result) {
            // if something is returned we notify the user
            if (!_.isEmpty(result)) {
              kuzzle.notifier.notify(requestId, {error: null, result: result.data}, connection);
            }
          })
          .catch(function onExecuteError(error) {
            if (_.isObject(error)) {
              error = error.toString();
            }

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
            action = routingArray[2],
            requestId;

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

        data = wrapObject(data, {controller: controller, collection: collection, action: action});
        requestId = data.requestId;

        // Listen broker because we waiting for writeEngine response
        if (['write', 'admin', 'bulk'].indexOf(data.controller) !== -1) {
          // Add an action ID into data in order to notify later the same user with the response from writeEngine
          data.internalId = uuid.v1();

          kuzzle.services.list.broker.listen('write_response_' + data.internalId, function (writeResponse) {
            kuzzle.notifier.notify(requestId, kuzzle.tools.cleanProperties(writeResponse), connection);
          });
        }

        kuzzle.funnel.execute(data, connection)
          .then(function onExecuteSuccess (result) {
            // if something is returned we notify the user
            if (!_.isEmpty(result)) {
              kuzzle.notifier.notify(requestId, {error: null, result: result.data}, connection);
            }

            kuzzle.notifier.notify(result.rooms, result.data);
          }.bind(this))
          .catch(function onExecuteError(error) {
            if (_.isObject(error)) {
              error = error.toString();
            }

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

  data = wrapObject(request.body, data);

  response.writeHead('Access-Control-Allow-Origin', '*');
  response.writeHead('Access-Control-Allow-Headers', 'X-Requested-With');

  // Listen broker because we waiting for writeEngine response
  if (['write', 'admin', 'bulk'].indexOf(data.controller) !== -1) {
    // Add an internal ID into data in order to notify later the same user with the response from writeEngine
    data.internalId = uuid.v1();

    this.services.list.broker.listen('write_response_' + data.internalId , function (writeResponse) {
      response.end(stringify(this.tools.cleanProperties(writeResponse)));
    }.bind(this));
  }

  this.funnel.execute(data)
    .then(function (result) {
      response.writeHead(200, {'Content-Type': 'application/json'});

      // if something is returned we notify the user
      if (!_.isEmpty(result)) {
        response.end(stringify({error: null, result: this.tools.cleanProperties(result.data)}));
      }

    }.bind(this))
    .catch(function (error) {
      if (_.isObject(error)) {
        error = error.toString();
      }

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

  if (data.body._id !== undefined) {
    data._id = data.body._id;
    delete data.body._id;
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