var
  debug = require('debug')('kuzzle:broker:server'),
  fs = require('fs'),
  http = require('http'),
  net = require('net'),
  Promise = require('bluebird'),
  CircularList = require('easy-circular-list'),
  InternalError = require('kuzzle-common-objects').errors.InternalError,
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
  this.wss = null;
  this.rooms = {};
  this.handlers = {};
  this.pluginsManager = pluginsManager;
  this.eventName = brokerType;
  this.isDisabled = options.disabled === true;

  this.ws = cb => {
    var
      server = http.createServer(),
      initCB = () => {
        this.wss = new WS({ server }, {perMessageDeflate: false});
        cb();
      };

    this.wss = true;

    if (options.socket) {
      server.on('error', error => {

        if(error.code !== 'EADDRINUSE') {
          debug('[%s] broker server received an error:\n%O', this.eventName, error);

          throw error;
        }

        net.connect(options.socket, () => {
          // really in use, re-throw
          throw error;
        })
          .on('error', e => {
            if (e.code !== 'ECONNREFUSED') {
              debug('[%s] broker server can\'t open requested socket, seem to be already used by another process', this.eventName);

              throw e;
            }

            debug('[%s] broker server can\'t open requested socket, seem to be unused, trying to recreate it', this.eventName);

            fs.unlinkSync(options.socket);

            if (this.wss instanceof WS) {
              this.wss.close(() => {
                server.listen(options.socket);
              });
            }
            else {
              server.listen(options.socket);
            }
          });
      });

      debug('[%s] initialize broker server through socket "%s"', this.eventName, options.socket);

      server.listen(options.socket, initCB);
    }
    else if (options.port) {
      if (options.host) {
        debug('[%s] initialize broker server through net port "%s" on host "%s"', this.eventName, options.port, options.host);

        server.listen(options.port, options.host, initCB);
      }
      else {
        debug('[%s] initialize broker server through net port "%s"', this.eventName, options.port, options.host);

        server.listen(options.port, initCB);
      }
    }
    else {
      throw new InternalError(`Invalid configuration provided for ${this.eventName}. Either "port" or "socket" must be provided.`);
    }
  };
  
  this.onErrorHandlers = [];
  this.onCloseHandlers = [];
}

/**
 * Initializes the server by setting the underlying ws.WebSocket.Server up.
 *
 * @returns {Promise}
 */
WSBrokerServer.prototype.init = function wSBrokerServerInit () {
  if (this.isDisabled) {
    this.pluginsManager.trigger('log:warn', 'Internal broker disabled by configuration');
    return Promise.resolve();
  }

  if (this.wss) {
    return Promise.reject(new InternalError('Websocket server already started'));
  }

  return new Promise(resolve => {
    this.ws(() => {
      this.wss.on('connection', clientSocket => {

        debug('[%s][%s] broker server received a connection', this.eventName, clientSocket.upgradeReq ? clientSocket.upgradeReq.headers['sec-websocket-key'] : 'unknown identifier');

        clientSocket.on('message', msg => {
          msg = JSON.parse(msg);

          debug('[%s][%s] received a message though broker server connection:\n%O', this.eventName, clientSocket.upgradeReq ? clientSocket.upgradeReq.headers['sec-websocket-key'] : 'unknown identifier', msg);

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
          debug('[%s][%s] broker server connection closed with code "%s" and message:\n%O', this.eventName, clientSocket.upgradeReq ? clientSocket.upgradeReq.headers['sec-websocket-key'] : 'unknown identifier', code, message);

          this.pluginsManager.trigger('log:info', `client disconnected [${code}] ${message}`);
          removeClient.call(this, clientSocket);
        });

        clientSocket.on('error', err => {
          debug('[%s][%s] broker server connection errored:\n%O', this.eventName, clientSocket.upgradeReq ? clientSocket.upgradeReq.headers['sec-websocket-key'] : 'unknown identifier', err);

          this.pluginsManager.trigger('log:error', err);
        });
      });

      this.wss.on('error', error => {
        debug('[%s] broker server errored:\n%O', this.eventName, error);

        this.pluginsManager.trigger('log:error', `Connection error: [${error.code}] ${error.message}`);
        this.onErrorHandlers.forEach(f => f());
      });

      resolve();
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

  debug('[%s] broadcast message though broker server in room "%s":\n%O', this.eventName, room, data);

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

  debug('[%s] sending message though broker server in room "%s":\n%O', this.eventName, room, data);

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
  debug('[%s] broker server dispatching data to room "%s":\n%O', this.eventName, room, data);

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
 * @param {function} cb The callback to execute
 */
WSBrokerServer.prototype.listen = function wSBrokerServerListen (room, cb) {
  debug('[%s] broker server subscribed to room "%s"', this.eventName, room);

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
  var interval;

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
  debug('[%s] broker server unsubscribed to room "%s"', this.eventName, room);

  if (this.handlers[room]) {
    delete this.handlers[room];
  }
};

/**
 * Closes the server underlying Web socket.
 */
WSBrokerServer.prototype.close = function wSBrokerServerClose () {
  this.wss.close();
  this.wss = null;
};

/**
 * Returns the underlying Websocket.
 *
 * @returns {WS}
 */
WSBrokerServer.prototype.socket = function wSBrokerServerSocket () {
  return this.wss;
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

  Object.keys(this.rooms).forEach(roomId => {
    this.rooms[roomId].remove(clientSocket);
    if (this.rooms[roomId].getSize() === 0) {
      this.onCloseHandlers.forEach(f => f(roomId));
      delete this.rooms[roomId];
    }
  });
}


