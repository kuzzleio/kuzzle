var
  async = require('async'),
  q = require('q'),
  CircularList = require('easy-circular-list'),
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  WS = require('ws').Server,
  _kuzzle;

/**
 * Web Socket server implementation of Kuzzle's internal broker.
 *
 * @param brokerType
 * @param options
 * @param kuzzle
 * @constructor
 */
function WSBrokerServer (brokerType, options, kuzzle) {
  this.server = null;
  this.rooms = {};
  this.handlers = {};
  this.eventName = brokerType;

  this.options = {
    server: {
      port: options.port,
      perMessageDeflate: false
    }
  };

  this.ws = (options, cb) => new WS(options, cb);

  _kuzzle = kuzzle;
}

/**
 * Initializes the server by setting the underlying ws.WebSocket.Server up.
 *
 * @returns {promise}
 */
WSBrokerServer.prototype.init = function () {
  var
    deferred = q.defer();

  if (this.server) {
    deferred.reject(new InternalError('Websocket server already started'));
    return deferred.promise;
  }

  this.server = this.ws(this.options.server, () => {
    deferred.resolve();
  });

  this.server.on('connection', clientSocket => {
    clientSocket.on('message', msg => {
      msg = JSON.parse(msg);

      switch (msg.action) {
        // the listen action is called by the client to inform the server it
        // wants to be notified on the room activity
        case 'listen':
          if (this.rooms[msg.room] === undefined) {
            this.rooms[msg.room] = new CircularList([]);
          }
          if (this.rooms[msg.room].getArray().indexOf(clientSocket) === -1) {
            this.rooms[msg.room].add(clientSocket);
          }
          break;
        case 'unsubscribe':
          if (this.rooms[msg.room]) {
            this.rooms[msg.room].remove(clientSocket);
            if (this.rooms[msg.room].getSize() === 0) {
              delete this.rooms[msg.room];
            }
          }
          break;

        // broadcast & send can be used in 2 ways:
        //   1 - (most common): pass a message to the server to a room on which
        //                      a callback was set to trigger a remote action
        //   2 - If some other clients have subscribed to the room, they will
        //       be also notified
        case 'send':
          this.dispatch(msg.room, msg.data);
          this.send(msg.room, msg.data, clientSocket);
          break;
        case 'broadcast':
          this.dispatch(msg.room, msg.data);
          this.broadcast(msg.room, msg.data, clientSocket);
          break;
      }
    });

    clientSocket.on('close', (code, message) => {
      _kuzzle.pluginsManager.trigger('log:info', `client disconnected [${code}] ${message}`);
      removeClient.call(this, clientSocket);
    });

    clientSocket.on('error', err => {
      _kuzzle.pluginsManager.trigger('log:error', err);
    });
  });

  return deferred.promise;
};

/**
 * Broadcasts `data` to *all* clients that have subscribed to the `room` but
 * the emitter.
 *
 * @param {string} room
 * @param {object} data
 * @returns {int} Number of clients the message was sent to ; -1 if the room does not exist.
 */
WSBrokerServer.prototype.broadcast = function (room, data, emitterSocket) {
  var clients = 0;

  if (!this.rooms[room]) {
    return -1;
  }

  async.each(
    this.rooms[room].getArray(),
    (clientSocket, cb) => {
      try {
        if (clientSocket === emitterSocket) {
          return cb();
        }

        clients++;
        clientSocket.send(JSON.stringify({
          room: room,
          data: data
        }));

        cb();
      }
      catch (err) {
        cb(err);
      }
    },
    err => {
      if (err) {
        clients = -1;
        _kuzzle.pluginsManager.trigger('log:error', err);
      }
    });

  return clients;
};

/**
 * Sends `data` to *one* of the *other* clients that has subscribed to the `room`.
 *
 * @param {string} room
 * @param {object} data
 * @returns {Websocket|undefined} The socket to which the data was sent ; undefined if the room does not exist
 */
WSBrokerServer.prototype.send = function (room, data, emitterSocket) {
  var clientSocket;

  if (!this.rooms[room]) {
    return;
  }

  clientSocket = this.rooms[room].getNext();

  if (clientSocket === emitterSocket) {
    if (this.rooms[room].getSize() === 1) {
      return;
    }

    clientSocket = this.rooms[room].getNext();
  }

  clientSocket.send(JSON.stringify({
    room: room,
    data: data
  }));

  return clientSocket;
};

/**
 * Calls all callbacks registered to `room` passing them `data` as argument.
 *
 * @param {string} room
 * @param {object} data
 * @returns {int} the number of triggered callbacks ; -1 if the room does not exist
 */
WSBrokerServer.prototype.dispatch = function (room, data) {
  if (!this.handlers[room]) {
    return -1;
  }
  this.handlers[room].forEach(cb => cb(data));

  return this.handlers[room].length;
};

/**
 * Attaches a callback to a `room`
 *
 * @param {string} room
 * @param {function} cb   The callback to execute
 */
WSBrokerServer.prototype.listen = function (room, cb) {
  if (this.handlers[room] === undefined) {
    this.handlers[room] = [];
  }
  this.handlers[room].push(cb);
};

/**
 * Returns a promise that resolves only when a first client registers itself
 * to the `room`.
 *
 * @param {string} room
 * @returns {promise}
 */
WSBrokerServer.prototype.waitForClients = function (room) {
  var
    deferred,
    interval;

  if (this.rooms[room]) {
    return q();
  }

  deferred = q.defer();

  interval = setInterval(() => {
    if (this.rooms[room]) {
      deferred.resolve();
      clearInterval(interval);
    }
  }, 100);

  return deferred.promise;
};

/**
 * Stops listening to `room` notifications
 *
 * @param {string} room
 */
WSBrokerServer.prototype.unsubscribe = function (room) {
  if (this.handlers[room]) {
    delete this.handlers[room];
  }
};

/**
 * Closes the server underlying Web socket.
 */
WSBrokerServer.prototype.close = function () {
  this.server.close();
  this.server = null;
};

module.exports = WSBrokerServer;

/**
 * Given a client Web socket, closes it and removes all related subscribtions
 * and callbacks.
 *
 * @param {ws.WebSocket} clientSocket
 */
function removeClient (clientSocket) {
  clientSocket.close();

  Object.keys(this.rooms).forEach(room => {
    this.rooms[room].remove(clientSocket);
    if (this.rooms[room].getSize() === 0) {
      delete this.rooms[room];
    }
  });
}


