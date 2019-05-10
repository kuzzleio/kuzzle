/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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
  assert = require('assert'),
  debug = require('../../../../../kuzzleDebug')('kuzzle:entry-point:protocols:websocket'),
  Protocol = require('./protocol'),
  { Server: WebSocketServer } = require('ws'),
  ClientConnection = require('../clientConnection'),
  {
    Request,
    errors: {
      BadRequestError,
      InternalError: KuzzleInternalError
    }
  } = require('kuzzle-common-objects');

const idleSweepInterval = 30 * 60 * 1000;

/**
 * @class  WebSocketConnection
 */
class WebSocketConnection {
  constructor(socket) {
    this.alive = true;
    this.socket = socket;
    this.channels = new Set();
    this.lastActivity = Date.now();
  }
}

/**
 * @class WebsocketProtocol
 */
class WebSocketProtocol extends Protocol {
  constructor () {
    super();
    this.server = null;
    this.kuzzle = null;
    this.heartbeatInterval = null;
    this.idleSweepInterval = null;
    this.idleTimeout = 0;

    // Map<channel, Set<connection IDs>>
    this.channels = new Map();

    // Map<connection ID, WebSocketConnection>
    this.connectionPool = new Map();
  }

  /**
   *
   * @param {EmbeddedEntryPoint} entryPoint
   */
  init (entryPoint) {
    return super.init('websocket', entryPoint)
      .then(() => {
        const config = entryPoint.config.protocols.websocket;

        if (config.enabled === false) {
          return false;
        }

        debug('initializing WebSocket Server with config: %a', config);

        this._startHeartbeat(config.heartbeat);
        this._startIdleSweeps(config.idleTimeout);

        this.kuzzle = this.entryPoint.kuzzle;

        this.server = new WebSocketServer({
          server: entryPoint.httpServer,
          maxPayload: this.maxRequestSize,
          perMessageDeflate: false
        });

        this.server.on('connection', this.onConnection.bind(this));
        this.server.on('error', this.onServerError.bind(this));

        return true;
      });
  }

  onServerError(error) {
    this.kuzzle.pluginsManager.trigger(
      'log:error',
      `[websocket] An error has occured "${error.message}":\n${error.stack}`);
  }

  onConnection(socket, request) {
    if (request.url && request.url.startsWith('/socket.io/')) {
      // Discarding request management here: let socket.io protocol manage
      // this connection
      return;
    }

    const
      ips = this._getIps(request),
      connection = new ClientConnection(this.name, ips, request.headers),
      wsConnection = new WebSocketConnection(socket);

    debug('[%s] creating Websocket connection', connection.id);

    this.entryPoint.newConnection(connection);
    this.connectionPool.set(connection.id, wsConnection);

    socket.on('close', () => {
      debug('[%s] received a `close` event', connection.id);
      this.onClientDisconnection(connection.id);
    });

    socket.on('error', () => {
      debug('[%s] received an `error` event', connection.id);
      this.onClientDisconnection(connection.id);
    });

    socket.on('message', data => {
      debug('[%s] received a `message` event', connection.id);
      this.onClientMessage(connection, data);
    });

    socket.on('ping', () => {
      debug('[%s] received a `pong` event', connection.id);
      wsConnection.alive = true;
      wsConnection.lastActivity = Date.now();
    });

    socket.on('pong', () => {
      debug('[%s] received a `pong` event', connection.id);
      wsConnection.alive = true;
      wsConnection.lastActivity = Date.now();
    });
  }

  onClientDisconnection(clientId) {
    debug('[%s] Client disconnected', clientId);

    this.entryPoint.removeConnection(clientId);

    const connection = this.connectionPool.get(clientId);

    if (!connection) {
      return;
    }

    connection.alive = false;

    for (const channel of connection.channels) {
      const ids = this.channels.get(channel);

      if (ids) {
        ids.delete(clientId);
        if (ids.size === 0) {
          this.channels.delete(channel);
        }
      }
    }

    this.connectionPool.delete(clientId);
  }

  onClientMessage(connection, data) {
    const wsConnection = this.connectionPool.get(connection.id);

    if (!data || !wsConnection) {
      return;
    }

    wsConnection.lastActivity = Date.now();

    let parsed;

    debug('[%s] onClientMessage: %a', connection.id, data);

    try {
      parsed = JSON.parse(data);
    }
    catch (e) {
      /*
       we cannot add a "room" information since we need to extract
       a request ID from the incoming data, which is apparently
       not a valid JSON
       So... the error is forwarded to the client, hoping he know
       what to do with it.
       */
      return this._send(
        connection.id, JSON.stringify(new BadRequestError(e.message)));
    }

    try {
      this.entryPoint.execute(new Request(parsed, {connection}), result => {
        if (result.content && typeof result.content === 'object') {
          result.content.room = result.requestId;
        }
        return this._send(connection.id, JSON.stringify(result.content));
      });
    }
    catch (e) {
      const errobj = {
        room: parsed.requestId,
        status: 400,
        error: {
          message: e.message
        }
      };

      this.entryPoint.kuzzle.pluginsManager.trigger(
        'log:error', new KuzzleInternalError(e.message));

      return this._send(connection.id, JSON.stringify(errobj));
    }
  }

  broadcast(data) {
    /*
     Avoids stringifying the payload multiple times just to update the room:
     - we start deleting the last character, which is the closing JSON
       bracket ('}')
     - we then only have to inject the following string to each channel:
       ,"room":"<roomID>"}

     So, instead of stringifying the payload for each channel, we only concat
     a new substring to the original payload.
     */
    const payload = JSON.stringify(data.payload).slice(0, -1) + ',"room":"';

    debug('broadcast: %a', data);

    for (const channel of data.channels) {
      const connectionIds = this.channels.get(channel);

      if (connectionIds) {
        const channelPayload = payload + channel + '"}';

        for (const connectionId of connectionIds) {
          this._send(connectionId, channelPayload);
        }
      }
    }
  }

  notify(data) {
    const payload = data.payload;

    debug('notify: %a', data);

    data.channels.forEach(channel => {
      payload.room = channel;
      this._send(data.connectionId, JSON.stringify(payload));
    });
  }

  joinChannel(channel, connectionId) {
    debug('joinChannel: %s %s', channel, connectionId);

    const connection = this.connectionPool.get(connectionId);

    if (!connection || !connection.alive) {
      return;
    }

    let ids = this.channels.get(channel);

    if (!ids) {
      ids = new Set([connectionId]);
      this.channels.set(channel, ids);
    } else {
      ids.add(connectionId);
    }

    connection.channels.add(channel);
  }

  leaveChannel(channel, connectionId) {
    debug('leaveChannel: %s %s', channel, connectionId);

    const
      connection = this.connectionPool.get(connectionId),
      ids = this.channels.get(channel);

    if (!connection || !ids || !ids.has(connectionId)) {
      return;
    }

    ids.delete(connectionId);

    if (ids.size === 0) {
      this.channels.delete(channel);
    }

    connection.channels.delete(channel);
  }

  disconnect(clientId, message = 'Connection closed by remote host') {
    debug('[%s] disconnect', clientId);

    const connection = this.connectionPool.get(clientId);
    if (connection) {
      connection.alive = false;
      connection.socket.close(1011, message);
    }
  }

  _send (id, data) {
    debug('[%s] send: %a', id, data);

    const connection = this.connectionPool.get(id);

    if (connection && connection.alive &&
      connection.socket.readyState === connection.socket.OPEN
    ) {
      connection.socket.send(data);
      connection.lastActivity = Date.now();
    }
  }

  _startHeartbeat(heartbeat) {
    assert(
      Number.isInteger(heartbeat) && heartbeat >= 0,
      `WebSocket: invalid heartbeat value ${heartbeat}`);

    if (heartbeat > 0) {
      this.heartbeatInterval = setInterval(
        this._doHeartbeat.bind(this),
        heartbeat);
    }
  }

  _startIdleSweeps(idleTimeout) {
    assert(
      Number.isInteger(idleTimeout) && idleTimeout >= 0,
      `WebSocket: invalid heartbeat value ${idleTimeout}`);

    if (idleTimeout > 0) {
      this.idleTimeout = idleTimeout;
      this.idleSweepInterval = setInterval(
        this._sweepIdleSockets.bind(this),
        idleSweepInterval);
    }
  }

  _doHeartbeat() {
    debug('[WebSocket] Heartbeat');
    for (const connection of this.connectionPool.values()) {
      // did not respond since we last sent a PING request
      if (connection.alive === false) {
        // correctly triggers the 'close' event handler on that socket
        connection.socket.terminate();
      } else {
        connection.alive = false;
        connection.socket.ping();
      }
    }
  }

  _sweepIdleSockets() {
    debug('[WebSocket] Cleaning dead sockets');

    const now = Date.now();

    for (const connection of this.connectionPool.values()) {
      if ((now - connection.lastActivity) > this.idleTimeout) {
        // correctly triggers the 'close' event handler on that socket
        connection.socket.terminate();
      }
    }
  }
}

module.exports = WebSocketProtocol;
