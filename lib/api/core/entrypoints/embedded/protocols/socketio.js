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
  _protocol = 'socketio',
  debug = require('../../../../../kuzzleDebug')('kuzzle:entry-point:protocols:socketio'),
  ClientConnection = require('../clientConnection'),
  Protocol = require('./protocol'),
  Request = require('kuzzle-common-objects').Request,
  {
    KuzzleError,
    InternalError: KuzzleInternalError
  } = require('kuzzle-common-objects').errors;

/**
 * @class SocketIoProtocol
 */
class SocketIoProtocol extends Protocol {
  constructor() {
    super();

    this.sockets = {};
    this.io = null;

    this.entryPoint = null;
  }

  init(entryPoint) {
    debug('initializing socketIo Server with config: %a', entryPoint.config.socketio);

    if (!entryPoint.config.protocols.socketio.enabled) {
      return;
    }

    this.entryPoint = entryPoint;
    this.kuzzle = this.entryPoint.kuzzle;

    // SocketIo server listens by default to "/socket.io" path
    // (see (http://socket.io/docs/server-api/#server#path(v:string):server))
    this.io = require('socket.io')(entryPoint.httpServer);

    this.io.set('origins', entryPoint.config.protocols.socketio.origins);

    this.io.on('connection', socket => this.onConnection(socket));
    this.io.on('error', error => this.onServerError(error));
  }

  onServerError(error) {
    this.kuzzle.pluginsManager.trigger('log:error', '[socketio] An error has occured:\n' + error.stack);
  }

  onConnection(socket) {
    let ips = [socket.handshake.address];

    if (socket.handshake.headers['x-forwarded-for']) {
      ips = socket.handshake.headers['x-forwarded-for']
        .split(',')
        .map(s => s.trim())
        .concat(ips);
    }

    const connection = new ClientConnection(_protocol, ips, socket.handshake.headers);
    debug('[%s] creating SocketIO connection on socket %s', connection.id, socket.id);

    try {
      this.entryPoint.newConnection(connection);
    }
    catch (err) {
      this.entryPoint.log.warn('[socketio] Client connection refused with message "%s": initialization still underway', err.message);

      socket.disconnect();

      return false;
    }

    this.sockets[connection.id] = socket;

    socket.on('disconnect', () => {
      debug('[%s] receiving a `disconnect` event', connection.id);
      this.onClientDisconnection(connection.id);
    });

    socket.on('error', () => {
      debug('[%s] receiving a `error` event', connection.id);
      this.onClientDisconnection(connection.id);
    });

    socket.on('kuzzle', data => {
      debug('[%s] receiving a `kuzzle` event', connection.id);
      this.onClientMessage(socket, connection, data);
    });

    return true;
  }

  onClientDisconnection(clientId) {
    debug('[%s] onClientDisconnection', clientId);

    if (this.sockets[clientId]) {
      delete this.sockets[clientId];
      delete this.entryPoint.clients[clientId];

      return this.entryPoint.removeConnection(clientId);
    }
  }

  onClientMessage(socket, connection, data) {
    if (!data || !this.sockets[connection.id]) {
      return;
    }

    // socket.io parses the content by itself and does not expose the original message :\..
    if (JSON.stringify(data).length > this.entryPoint.httpServer.maxRequestSize) {
      this.kuzzle.pluginsManager.trigger('log:error', `[socketio] Input message length(${data.length}) exceeds maxRequestSize: ${this.entryPoint.httpServer.maxRequestSize}`);
      return this.io.to(socket.id).emit(data.requestId, {
        status: 413,
        error: {message: 'Error: maximum input request size exceeded'}
      });
    }

    debug('[%s] onClientMessage: %a', connection.id, data);

    try {
      this.entryPoint.execute(new Request(data, {
        connectionId: connection.id,
        protocol: _protocol,
        headers: connection.headers
      }), response => {
        this.io.to(socket.id).emit(response.requestId, response.content);
      });
    }
    catch (e) {
      this.entryPoint.kuzzle.pluginsManager.trigger('log:error', e instanceof KuzzleError ? e : new KuzzleInternalError(e.message));

      return this.io.to(socket.id).emit(data.requestId, {
        status: 400,
        error: {
          message: e.message
        }
      });
    }
  }

  broadcast(data) {
    debug('broadcast: %a', data);

    for (const channel of data.channels) {
      this.io.to(channel).emit(channel, data.payload);
    }
  }

  notify(data) {
    debug('notify: %a', data);

    if (this.sockets[data.connectionId]) {
      data.channels.forEach(channel => {
        this.sockets[data.connectionId].emit(channel, data.payload);
      });
    }
  }

  joinChannel(channel, connectionId) {
    debug('joinChannel: %s %s', channel, connectionId);

    if (this.sockets[connectionId]) {
      this.sockets[connectionId].join(channel);
    }
  }

  leaveChannel(channel, connectionId) {
    debug('leaveChannel: %s %s', channel, connectionId);

    if (this.sockets[connectionId]) {
      this.sockets[connectionId].leave(channel);
    }
  }

  disconnect(connectionId) {
    debug('[%s] disconnect', connectionId);

    if (this.sockets[connectionId]) {
      this.sockets[connectionId].disconnect();
    }
  }
}

module.exports = SocketIoProtocol;
