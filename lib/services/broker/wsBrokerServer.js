var
  async = require('async'),
  q = require('q'),
  CircularList = require('easy-circular-list'),
  InternalError = require('../../api/core/errors/internalError'),
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
            if (this.rooms[msg.room].length === 0) {
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
          this.send(msg.room, msg.data);
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
 * Broadcasts `data` to *all* clients that have subscribed to the `room`.
 *
 * @param {string} room
 * @param {object} data
 */
WSBrokerServer.prototype.broadcast = function (room, data, emitterSocket) {
  if (!this.rooms[room]) {
    return;
  }

  async.each(
    this.rooms[room].getArray(),
    clientSocket => {
      if (clientSocket === emitterSocket) {
        return;
      }

      clientSocket.send(JSON.stringify({
        action: 'send',
        room: room,
        data: data
      }));
    },
    err => {
      if (err) {
        _kuzzle.pluginsManager.trigger('log:error', err);
      }
    });
};

/**
 * Sends `data` to *one* of the clients that has subscribed to the `room`.
 *
 * @param {string} room
 * @param {object} data
 */
WSBrokerServer.prototype.send = function (room, data) {
  if (!this.rooms[room]) {
    return;
  }

  this.rooms[room].getNext().send(JSON.stringify({
    action: 'send',
    room: room,
    data: data
  }));
};

/**
 * Calls all callbacks registered to `room` passing them `data` as argument.
 *
 * @param {string} room
 * @param {object} data
 */
WSBrokerServer.prototype.dispatch = function (room, data) {
  if (!this.handlers[room]) {
    return;
  }
  this.handlers[room].forEach(cb => cb(data));
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


