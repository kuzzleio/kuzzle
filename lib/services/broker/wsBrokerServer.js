var
  Promise = require('bluebird'),
  CircularList = require('easy-circular-list'),
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  WS = require('ws').Server;

/**
 * Web Socket server implementation of Kuzzle's internal broker.
 *
 * @param brokerType
 * @param options
 * @param pluginsManager
 * @constructor
 */
function WSBrokerServer (brokerType, options, pluginsManager) {
  this.server = null;
  this.rooms = {};
  this.handlers = {};
  this.pluginsManager = pluginsManager;
  this.eventName = brokerType;

  this.options = {
    server: {
      port: options.port,
      perMessageDeflate: false
    }
  };

  this.ws = (wsOptions, cb) => new WS(wsOptions, cb);
  
  this.onErrorHandlers = [];
}

/**
 * Initializes the server by setting the underlying ws.WebSocket.Server up.
 *
 * @returns {Promise}
 */
WSBrokerServer.prototype.init = function wSBrokerServerInit () {
  if (this.server) {
    return Promise.reject(new InternalError('Websocket server already started'));
  }

  return new Promise(resolve => {
    this.server = this.ws(this.options.server, () => {
      resolve();
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
        this.pluginsManager.trigger('log:info', `client disconnected [${code}] ${message}`);
        removeClient.call(this, clientSocket);
      });

      clientSocket.on('error', err => {
        this.pluginsManager.trigger('log:error', err);
      });
    });

    this.server.on('error', error => {
      this.pluginsManager.trigger('log:error', `Connection error: [${error.code}] ${error.message}`);
      this.onErrorHandlers.forEach(f => f());
    });
  });
};

/**
 * Broadcasts `data` to *all* clients that have subscribed to the `room` but
 * the emitter.
 *
 * @param {string} room
 * @param {object} data
 * @param {WebSocket} emitterSocket
 * @returns {int} Number of clients the message was sent to ; -1 if the room does not exist.
 */
WSBrokerServer.prototype.broadcast = function wSBrokerServerBroadcast (room, data, emitterSocket) {
  var
    clients = 0,
    serializedMessage = JSON.stringify({
      room: room,
      data: data
    });

  if (!this.rooms[room]) {
    return -1;
  }

  this.rooms[room].getArray().forEach(clientSocket => {
    if (clientSocket === emitterSocket) {
      return;
    }

    try {
      clientSocket.send(serializedMessage);
      clients++;
    }
    catch (err) {
      // could not broadcast to one child, we let the other ones recieve the message
      this.pluginsManager.trigger('log:error', err);
    }
  });

  return clients;
};

/**
 * Sends `data` to *one* of the *other* clients that has subscribed to the `room`.
 *
 * @param {string} room
 * @param {object} data
 * @param {WebSocket} emitterSocket
 * @returns {WebSocket|undefined} The socket to which the data was sent ; undefined if the room does not exist
 */
WSBrokerServer.prototype.send = function wSBrokerServerSend (room, data, emitterSocket) {
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
WSBrokerServer.prototype.dispatch = function wSBrokerServerDispatch (room, data) {
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
WSBrokerServer.prototype.listen = function wSBrokerServerListen (room, cb) {
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
 * @returns {Promise}
 */
WSBrokerServer.prototype.waitForClients = function wSBrokerServerWaitForClients (room) {
  var
    interval;

  if (this.rooms[room]) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    interval = setInterval(() => {
      if (this.rooms[room]) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
};

/**
 * Stops listening to `room` notifications
 *
 * @param {string} room
 */
WSBrokerServer.prototype.unsubscribe = function wSBrokerServerUnsubscribe (room) {
  if (this.handlers[room]) {
    delete this.handlers[room];
  }
};

/**
 * Closes the server underlying Web socket.
 */
WSBrokerServer.prototype.close = function wSBrokerServerClose () {
  this.server.close();
  this.server = null;
};

/**
 * Returns the underlying Websocket.
 *
 * @returns {WS}
 */
WSBrokerServer.prototype.socket = function wSBrokerServerSocket () {
  return this.server;
};

module.exports = WSBrokerServer;

/**
 * Given a client Web socket, closes it and removes all related subscribtions
 * and callbacks.
 *
 * @this WSBrokerServer
 * @param {WebSocket} clientSocket
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


