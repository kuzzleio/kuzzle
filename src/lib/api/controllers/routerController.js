var
// library for execute asynchronous methods
  async = require('async'),
  _ = require('lodash'),
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

    this.router = new Router();

    // create and mount a new router for our API
    var api = new Router();
    this.router.use('/api/', api);

    // add a body parsing middleware to our API
    api.use(bodyParser.json());

    // define the function that will be call in case of error
    var sendError = function (error, response) {
      response.writeHead(400, {'Content-Type': 'application/json'});
      response.end(JSON.stringify({error: error, result: null}));
      return false;
    };

    // define routes
    api.post('/', function (request, response) {
      if (request.body) {
        var data = wrapObject(request.body, 'write', 'article', 'create');

        kuzzle.funnel.execute(data, request)
          .then(function onExecuteSuccess (result) {
            // Send response and close connection
            this.notify(result.requestId, result);
            response.writeHead(200, {'Content-Type': 'application/json'});
            response.end(JSON.stringify({error: null, result: result}));
          }.bind(this))
          .catch(function onExecuteError (error) {
            return sendError(error, response);
          });
      }
      else {
        return sendError('Empty data', response);
      }
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
    var routerCtrl = this;

    async.each(this.controllers, function recordSocketListener (controller) {

      socket.on(controller, function (data) {
        kuzzle.log.silly('Handle Websocket', controller, 'request');
        data = wrapObject(data, controller);

        // execute the funnel. If error occurred, notify users
        kuzzle.funnel.execute(data, socket.id)
          .then(function onExecuteSuccess (result) {
            if (result.rooms) {
              async.each(result.rooms, function (roomName) {
                routerCtrl.notify(roomName, result.data);
              });
            }
          }.bind(this))
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
    async.each(this.controllers, function recordMQListener (controller) {
      broker.listenExchange(controller+'.*.*', function handleMQMessage(data, routingKey) {
        kuzzle.log.silly('Handle MQ input', routingKey , 'message');
        var routingArray = routingKey.split('.');
        var controller = routingArray[0];
        var collection = routingArray[1];
        var action = routingArray[2];
        data = wrapObject(data, controller, collection, action);
        kuzzle.funnel.execute(data);
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
   * @param {Object} socket
   */
  this.notify = function (room, data, socket) {
    if (socket) {
      socket.emit(room, data);
    }
    else {
      kuzzle.io.emit(room, data);
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
    var stringifyObject = JSON.stringify(data);
    data.requestId = crypto.createHash('md5').update(stringifyObject).digest('hex');
  }

  return data;
}
