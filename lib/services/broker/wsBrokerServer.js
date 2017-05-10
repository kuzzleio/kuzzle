/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  debug = require('../../kuzzleDebug')('kuzzle:broker:server'),
  path = require('path'),
  Bluebird = require('bluebird'),
  CircularList = require('easy-circular-list'),
  KuzzleInternalError = require('kuzzle-common-objects').errors.InternalError,
  fs = require('fs'),
  http = require('http'),
  net = require('net'),
  WS = require('ws').Server;

/**
 * Web Socket server implementation of Kuzzle's internal broker.
 *
 * @class WSBrokerServer
 * @param brokerType
 * @param options
 * @param pluginsManager
 */
class WSBrokerServer {
  constructor(brokerType, options, pluginsManager) {
    this.wss = null;
    this.rooms = {};
    this.handlers = {};
    this.pluginsManager = pluginsManager;
    this.eventName = brokerType;
    this.isDisabled = options.disabled === true;
    this.options = options;
    this.onErrorHandlers = [];
    this.onCloseHandlers = [];
  }

  ws(cb) {
    const
      server = http.createServer(),
      initCB = () => {
        this.wss = new WS({server}, {perMessageDeflate: false});
        cb();
      };

    this.wss = true;

    if (this.options.socket) {
      const
        socketPath = path.resolve(__dirname, '../../../', this.options.socket),
        socketDir = path.dirname(socketPath);

      if (!fs.existsSync(socketDir)) {
        throw new KuzzleInternalError(`Invalid configuration provided for ${this.eventName}. Could not find ${socketDir} directory.`);
      }

      server.on('error', error => {
        if (error.code !== 'EADDRINUSE') {
          debug('[%s] broker server received an error: %a', this.eventName, error);

          throw error;
        }

        net.connect(socketPath, () => {
          // really in use, re-throw
          throw error;
        })
          .on('error', e => {
            if (e.code !== 'ECONNREFUSED') {
              debug('[%s] broker server can\'t open requested socket, seem to be already used by another process', this.eventName);

              throw e;
            }

            debug('[%s] broker server can\'t open requested socket, seem to be unused, trying to recreate it', this.eventName);

            fs.unlinkSync(socketPath);

            if (this.wss instanceof WS) {
              this.wss.close(() => {
                server.listen(socketPath);
              });
            }
            else {
              server.listen(socketPath);
            }
          });
      });

      debug('[%s] initialize broker server through socket "%s"', this.eventName, socketPath);

      server.listen(socketPath, initCB);
    }
    else if (this.options.port) {
      if (this.options.host) {
        debug('[%s] initialize broker server through net port "%s" on host "%s"', this.eventName, this.options.port, this.options.host);

        server.listen(this.options.port, this.options.host, initCB);
      }
      else {
        debug('[%s] initialize broker server through net port "%s"', this.eventName, this.options.port, this.options.host);

        server.listen(this.options.port, initCB);
      }
    }
    else {
      throw new KuzzleInternalError(`Invalid configuration provided for ${this.eventName}. Either "port" or "socket" must be provided.`);
    }
  }

  /**
   * Initializes the server by setting the underlying ws.WebSocket.Server up.
   *
   * @returns {Promise}
   */
  init() {
    if (this.isDisabled) {
      this.pluginsManager.trigger('log:warn', 'Internal broker disabled by configuration');
      return Bluebird.resolve();
    }

    if (this.wss) {
      return Bluebird.reject(new KuzzleInternalError('Websocket server already started'));
    }

    return new Bluebird(resolve => {
      this.ws(() => {
        this.wss.on('connection', clientSocket => {

          debug('[%s][%s] broker server received a connection', this.eventName, clientSocket.upgradeReq ? clientSocket.upgradeReq.headers['sec-websocket-key'] : 'unknown identifier');

          clientSocket.on('message', raw => {
            const msg = JSON.parse(raw);

            debug('[%s][%s] received a message though broker server connection: %a', this.eventName, clientSocket.upgradeReq ? clientSocket.upgradeReq.headers['sec-websocket-key'] : 'unknown identifier', msg);

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
              default:
                throw new KuzzleInternalError(`Internal broker: unknown message action received: ${msg.action}`);
            }
          });

          clientSocket.on('close', (code, message) => {
            debug('[%s][%s] broker server connection closed with code "%s" and message: %a', this.eventName, clientSocket.upgradeReq ? clientSocket.upgradeReq.headers['sec-websocket-key'] : 'unknown identifier', code, message);

            this.pluginsManager.trigger('log:info', `client disconnected [${code}] ${message}`);
            removeClient(this, clientSocket);
          });

          clientSocket.on('error', err => {
            debug('[%s][%s] broker server connection errored: %a', this.eventName, clientSocket.upgradeReq ? clientSocket.upgradeReq.headers['sec-websocket-key'] : 'unknown identifier', err);

            this.pluginsManager.trigger('log:error', err);
          });
        });

        this.wss.on('error', error => {
          debug('[%s] broker server errored: %a', this.eventName, error);

          this.pluginsManager.trigger('log:error', `Connection error: [${error.code}] ${error.message}`);
          this.onErrorHandlers.forEach(f => f());
        });

        resolve();
      });

    });
  }

  /**
   * Broadcasts `data` to *all* clients that have subscribed to the `room` but
   * the emitter.
   *
   * @param {string} room
   * @param {object} data
   * @param {WebSocket} emitterSocket
   * @returns {int} Number of clients the message was sent to ; -1 if the room does not exist.
   */
  broadcast(room, data, emitterSocket) {
    const serializedMessage = JSON.stringify({room, data});
    let clients = 0;

    debug('[%s] broadcast message though broker server in room "%s": %a', this.eventName, room, data);

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
  }

  /**
   * Sends `data` to *one* of the *other* clients that has subscribed to the `room`.
   *
   * @param {string} room
   * @param {object} data
   * @param {WebSocket} [emitterSocket]
   * @returns {WebSocket|null} The socket to which the data was sent ; undefined if the room does not exist
   */
  send(room, data, emitterSocket) {
    debug('[%s] sending message though broker server in room "%s": %a', this.eventName, room, data);

    if (!this.rooms[room]) {
      return null;
    }

    let clientSocket = this.rooms[room].getNext();

    if (clientSocket === emitterSocket) {
      if (this.rooms[room].getSize() === 1) {
        return null;
      }

      clientSocket = this.rooms[room].getNext();
    }

    clientSocket.send(JSON.stringify({room, data}));

    return clientSocket;
  }

  /**
   * Calls all callbacks registered to `room` passing them `data` as argument.
   *
   * @param {string} room
   * @param {object} data
   * @returns {int} the number of triggered callbacks ; -1 if the room does not exist
   */
  dispatch(room, data) {
    debug('[%s] broker server dispatching data to room "%s": %a', this.eventName, room, data);

    if (!this.handlers[room]) {
      return -1;
    }

    this.handlers[room].forEach(cb => cb(data));

    return this.handlers[room].length;
  }

  /**
   * Attaches a callback to a `room`
   *
   * @param {string} room
   * @param {function} cb The callback to execute
   */
  listen(room, cb) {
    debug('[%s] broker server subscribed to room "%s"', this.eventName, room);

    if (this.handlers[room] === undefined) {
      this.handlers[room] = [];
    }

    this.handlers[room].push(cb);
  }

  /**
   * Returns a promise that resolves only when a first client registers itself
   * to the `room`.
   *
   * @param {string} room
   * @returns {Promise}
   */
  waitForClients(room) {
    if (this.rooms[room]) {
      return Bluebird.resolve();
    }

    return new Bluebird(resolve => {
      const interval = setInterval(() => {
        if (this.rooms[room]) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Stops listening to `room` notifications
   *
   * @param {string} room
   */
  unsubscribe(room) {
    debug('[%s] broker server unsubscribed to room "%s"', this.eventName, room);

    if (this.handlers[room]) {
      delete this.handlers[room];
    }
  }

  /**
   * Closes the server underlying Web socket.
   */
  close() {
    this.wss.close();
    this.wss = null;
  }

  /**
   * Returns the underlying Websocket.
   *
   * @returns {WS}
   */
  socket() {
    return this.wss;
  }
}

module.exports = WSBrokerServer;

/**
 * Given a client Web socket, closes it and removes all related subscribtions
 * and callbacks.
 *
 * @this WSBrokerServer
 * @param {WSBrokerServer} broker
 * @param {WebSocket} clientSocket
 */
function removeClient (broker, clientSocket) {
  clientSocket.close();

  Object.keys(broker.rooms).forEach(roomId => {
    broker.rooms[roomId].remove(clientSocket);
    if (broker.rooms[roomId].getSize() === 0) {
      broker.onCloseHandlers.forEach(f => f(roomId));
      delete broker.rooms[roomId];
    }
  });
}
