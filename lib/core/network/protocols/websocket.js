/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

const assert = require('assert');
const { Server: WebSocketServer, Sender } = require('ws');

const { Request } = require('../../../api/request');
const Protocol = require('./protocol');
const ClientConnection = require('../clientConnection');
const removeErrorStack = require('../removeErrorStack');
const debug = require('../../../util/debug')('kuzzle:entry-point:protocols:websocket');

const kerror = require('../../../kerror').wrap('network', 'websocket');

// Used by the broadcast method to build JSON payloads while limiting the
// number of JSON serializations
const jsonRoomProp = ',"room":"';
const jsonEnder = '"}';

// Passed to ws.Sender to build a RFC-6455 frame
const wsFrameOptions = {
  fin: true,
  mask: false,
  opcode: 1,
  readOnly: true,
  rsv1: false
};

/**
 * @class  WebSocketConnection
 */
class WebSocketConnection {
  constructor(socket, lastActivity) {
    this.alive = true;
    this.socket = socket;
    this.channels = new Set();
    this.lastActivity = lastActivity;
  }
}

/**
 * @class WebsocketProtocol
 */
class WebSocketProtocol extends Protocol {
  constructor () {
    super('websocket');
    this.server = null;
    this.heartbeatInterval = null;
    this.idleSweepInterval = null;

    // Prevents thousands of "Date.now()" per second: it's far more efficient
    // to have a timestamp property refreshed every second or so, since we
    // don't need to be more precise than that
    this.activityTimestamp = Date.now();
    this.activityInterval = setInterval(() => {
      this.activityTimestamp = Date.now();
    }, 1000);

    // Map<channel, Set<connection IDs>>
    this.channels = new Map();

    // Map<connection ID, WebSocketConnection>
    this.connectionPool = new Map();
  }

  /**
   *
   * @param {EmbeddedEntryPoint} entryPoint
   */
  async init (entryPoint) {
    await super.init(null, entryPoint);

    if (this.config.enabled === false) {
      return false;
    }

    debug('initializing WebSocket Server with config: %a', this.config);

    this._startHeartbeat();
    this._startIdleSweeps();

    this.server = new WebSocketServer({
      maxPayload: this.maxRequestSize,
      perMessageDeflate: false,
      server: entryPoint.httpServer
    });

    this.server.on('connection', this.onConnection.bind(this));
    this.server.on('error', this.onServerError.bind(this));

    return true;
  }

  onServerError(error) {
    global.kuzzle.log.error(
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
      wsConnection = new WebSocketConnection(socket, this.activityTimestamp);

    debug('[%s] creating Websocket connection', connection.id);

    this.entryPoint.newConnection(connection);
    this.connectionPool.set(connection.id, wsConnection);

    socket.on('close', (code, reason) => {
      debug(
        '[%s] received a `close` event (CODE: %d, REASON: %s)',
        connection.id,
        code,
        reason);

      this.onClientDisconnection(connection.id);
    });

    socket.on('error', () => {
      debug('[%s] received an `error` event', connection.id);
      this.onClientDisconnection(connection.id);
    });

    socket.on('message', data => {
      console.log('received node message');
      debug('[%s] received a `message` event', connection.id);
      this.onClientMessage(connection, data);
    });

    socket.on('ping', () => {
      console.log('received node ping');
      debug('[%s] received a `ping` event', connection.id);
      wsConnection.alive = true;
      wsConnection.lastActivity = this.activityTimestamp;
    });

    socket.on('pong', () => {
      debug('[%s] received a `pong` event', connection.id);
      wsConnection.alive = true;
      wsConnection.lastActivity = this.activityTimestamp;
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

    wsConnection.lastActivity = this.activityTimestamp;

    let parsed;

    debug('[%s] onClientMessage: %a', connection.id, data);

    try {
      parsed = JSON.parse(data);
      if (parsed.p && parsed.p === '1') {
        debug('[%s] sending a `pong` message', connection.id);
        wsConnection.alive = true;
        console.log('sending custom pong');
        this._send(connection.id, '{"p":"1"}');
        return;
      }
    }
    catch (e) {
      /*
       we cannot add a "room" information since we need to extract
       a request ID from the incoming data, which is apparently
       not a valid JSON
       So... the error is forwarded to the client, hoping they know
       what to do with it.
       */
      const errRequest = new Request(
        {},
        {
          connection,
          error: kerror.getFrom(e, 'unexpected_error', e.message)
        });

      this._send(
        connection.id,
        JSON.stringify(removeErrorStack(errRequest.response.toJSON()).content));
      return;
    }

    try {
      this.entryPoint.execute(new Request(parsed, {connection}), result => {
        if (result.content && typeof result.content === 'object') {
          result.content.room = result.requestId;
        }
        this._send(connection.id, JSON.stringify(result.content));
      });
    }
    catch (e) {
      const errobj = {
        error: {
          message: e.message
        },
        room: parsed.requestId,
        status: 400
      };

      this._send(connection.id, JSON.stringify(errobj));
    }
  }

  /**
   * /!\ WARNING: CRITICAL CODE SECTION AHEAD /!\
   * (this means performance over maintenability or readability... sorry)
   *
   * Do not change without reason: this method is used by the real-time engine
   * to send very similar notifications to A LOT of different sockets
   *
   * This function precomputes RFC-6455 WebSocket frames and send them raw to
   * destination sockets. This prevents the recomputing of the same frame
   * over and over again for each broadcast.
   *
   * @param  {Object} data
   */
  broadcast (data) {
    const
      stringified = JSON.stringify(data.payload),
      payloadByteSize = Buffer.from(stringified).byteLength,
      // 255 bytes should be enough to hold the following:
      //     ,"room":"<channel identifier>"
      // (with current channel encoding, this is less than 100 bytes)
      payload = Buffer.allocUnsafe(payloadByteSize + 255);

    let offset = payloadByteSize - 1;

    payload.write(stringified, 0);
    payload.write(jsonRoomProp, offset);

    offset += jsonRoomProp.length;

    for (const channel of data.channels) {
      const connectionIds = this.channels.get(channel);

      if (connectionIds) {
        // Adds the room property to the message
        payload.write(channel, offset);
        payload.write(jsonEnder, offset + channel.length);

        // prevent buffer overwrites due to socket.send being an
        // async method (race condition)
        const
          payloadLength = offset + channel.length + jsonEnder.length,
          payloadSafeCopy = Buffer.allocUnsafe(payloadLength);

        payload.copy(payloadSafeCopy, 0, 0, payloadLength);

        const frame = Sender.frame(payloadSafeCopy, wsFrameOptions);

        for (const connectionId of connectionIds.values()) {
          const connection = this.connectionPool.get(connectionId);

          if ( connection
            && connection.alive
            && connection.socket.readyState === connection.socket.OPEN
          ) {
            connection.socket._sender.sendFrame(frame);
          }
        }
      }
    }
  }

  notify(data) {
    const payload = data.payload;

    debug('notify: %a', data);

    for (let i = 0; i < data.channels.length; i++) {
      payload.room = data.channels[i];
      this._send(data.connectionId, JSON.stringify(payload));
    }
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

  disconnect(connectionId, message = 'Connection closed by remote host') {
    debug('[%s] disconnect', connectionId);

    const connection = this.connectionPool.get(connectionId);
    if (connection) {
      connection.alive = false;
      connection.socket.close(1011, message);
    }
  }

  _send (id, data) {
    debug('[%s] send: %a', id, data);

    const connection = this.connectionPool.get(id);

    if ( connection
      && connection.alive
      && connection.socket.readyState === connection.socket.OPEN
    ) {
      connection.socket.send(data);
    }
  }

  _startHeartbeat() {
    assert(
      Number.isInteger(this.config.heartbeat) && this.config.heartbeat >= 0,
      `WebSocket: invalid heartbeat value ${this.config.heartbeat}`);

    if (this.config.heartbeat > 0) {
      this.heartbeatInterval = setInterval(
        this._doHeartbeat.bind(this),
        this.config.heartbeat);
    }
  }

  _startIdleSweeps() {
    assert(
      Number.isInteger(this.config.idleTimeout) && this.config.idleTimeout >= 0,
      `WebSocket: invalid idleTimeout value ${this.config.idleTimeout}`);

    if (this.config.idleTimeout > 0) {
      this.idleSweepInterval = setInterval(
        this._sweepIdleSockets.bind(this),
        this.config.idleTimeout);
    }
  }

  _doHeartbeat() {
    debug('Heartbeat');
    const
      lastActivityThreshold = this.activityTimestamp - this.config.heartbeat;

    for (const connection of this.connectionPool.values()) {
      if ( connection.alive === false
        || connection.socket.readyState !== connection.socket.OPEN
      ) {
        connection.socket.terminate();
      } else if (connection.lastActivity < lastActivityThreshold) {
        // emit a PING request only if the socket has been inactive for longer
        // than the heartbeat value
        connection.alive = false;
        connection.socket.ping();
      }
    }
  }

  _sweepIdleSockets() {
    debug('Cleaning dead sockets');

    const now = Date.now();

    for (const connection of this.connectionPool.values()) {
      if ((now - connection.lastActivity) > this.config.idleTimeout) {
        // correctly triggers the 'close' event handler on that socket
        connection.socket.terminate();
      }
    }
  }
}

module.exports = WebSocketProtocol;
