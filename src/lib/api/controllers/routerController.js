var
// library for execute asynchronous methods
  async = require('async'),
  _ = require('lodash'),
  stringify = require('json-stable-stringify'),
  Router = require('router'),
  broker = require('../../services/broker'),
  // For parse a request sent by user
  bodyParser = require('body-parser'),
  // For final step to respond to HTTP request
  finalhandler = require('finalhandler'),
  // Used for hash into md5 the data for generate a requestId
  crypto = require('crypto');


module.exports = function RouterController (kuzzle) {

  this.router = null;
  this.controllers = ['write', 'read', 'subscribe'];

  this.initRouterHttp = function () {
    var routerCtrl = this;

    this.router = new Router();

    // create and mount a new router for our API
    var api = new Router();
    this.router.use('/api/', api);

    // add a body parsing middleware to our API
    api.use(bodyParser.json());

    // define the function that will be call in case of error
    var sendError = function (error, response) {
      response.writeHead(400, {'Content-Type': 'application/json'});
      response.end(stringify({error: error, result: null}));
      return false;
    };

    // define routes
    api.post('/:collection', function (request, response) {
      if (request.body) {
        var data = wrapObject(request.body, 'write', request.params.collection, 'create'),
            connection = {type: 'rest', id: request};

        kuzzle.funnel.execute(data, connection)
          .then(function onExecuteSuccess (result) {
            // Send response and close connection
            if (result.rooms) {
              async.each(result.rooms, function (roomName) {
                routerCtrl.notify(roomName, result.data, result.connections);
              });
            }
            response.writeHead(200, {'Content-Type': 'application/json'});
            response.end(stringify({error: null, result: result.data}));
          })
          .catch(function onExecuteError (error) {
            return sendError(error, response);
          });
      }
      else {
        return sendError('Empty data', response);
      }
    });

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
    var routerCtrl = this,
        connection = {type: 'websocket', id: socket.id};

    async.each(routerCtrl.controllers, function recordSocketListener (controller) {

      socket.on(controller, function (data) {
        kuzzle.log.silly('Handle Websocket', controller, 'request');
        data = wrapObject(data, controller);

        // execute the funnel. If error occurred, notify users
        kuzzle.funnel.execute(data, connection)
          .then(function onExecuteSuccess (result) {
            if (result.rooms) {
              async.each(result.rooms, function (roomName) {
                routerCtrl.notify(roomName, result.data, result.connections);
              });
            }
          })
          .catch(function onExecuteError(error) {
            routerCtrl.notify(data.requestId, {error: error}, socket);
            kuzzle.log.verbose({error: error});
          });
      });

    });

    // add a specific disconnect event for websocket
    socket.on('disconnect', function () {
      kuzzle.hotelClerk.removeCustomerFromAllRooms(socket.id);
    });
  };

  this.routeMQListener = function () {
    var routerCtrl = this;
    async.each(this.controllers, function recordMQListener (controller) {
      broker.listenExchange(controller+'.*.*', function handleMQMessage(msg) {
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
          connectionId = "mqtt."+data.mqttClientId;
        }

        if (connectionId) {
          connection = {type: connectionId.split('.')[0], id: connectionId};
        }

        if (connectionId && ! data.requestId) {
          data.requestId = connectionId;
        }

        data = wrapObject(data, controller, collection, action);

        kuzzle.funnel.execute(data, connection)
          .then(function onExecuteSuccess (result) {
            if (result.rooms) {
              async.each(result.rooms, function (roomName) {
                routerCtrl.notify(roomName, result.data, result.connections);
              });
            }
          })
          .catch(function onExecuteError(error) {
            routerCtrl.notify(data.requestId, {error: error});
            kuzzle.log.verbose({error: error});
          });
      });
    });
  };

  /**
   * Notify by message data on the request Id channel
   * If socket is defined, we send the event only on this socket,
   * otherwise, we send to all sockets on the room
   *
   * @param {String} room
   * @param {Object} data
   * @param {Object} connections
   */
  this.notify = function (room, data, connections) {
    if (connections) {
      async.each(connections, function (connection) {
        switch (connection.type) {
          case 'websocket':
            kuzzle.io.to(connection.id).emit(room, data);
            break;
          case 'amq':
            broker.replyTo(connection.id, data);
            break;
          case "mqtt":
            broker.addExchange(connection.id, data);
            break;
        }
      });
    }
    else {
      kuzzle.io.emit(room, data);
      broker.addExchange(room, data);
    }
  };
};

function wrapObject (data, controller, collection, action) {
  if (data.content === 'undefined') {
    data = {content: data};
  }

  data.controller = controller;

  if (collection) {
    data.collection = collection;
  }

  if (action) {
    data.action = action;
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
