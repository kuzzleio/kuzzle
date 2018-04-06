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
  debug = require('../../../../../kuzzleDebug')('kuzzle:entry-point:protocols:websocket'),
  Protocol = require('./protocol'),
  Request = require('kuzzle-common-objects').Request,
  WebSocketServer = require('ws').Server,
  ClientConnection = require('../clientConnection'),
  {
    BadRequestError,
    InternalError: KuzzleInternalError
  } = require('kuzzle-common-objects').errors;

/**
 * @class WebsocketProtocol
 */
class WebsocketProtocol extends Protocol {
  constructor () {
    super();

    this.channels = {};
    this.connectionPool = {};
    this.server = null;
    this.protocol = 'websocket';
  }

  /**
   *
   * @param {EmbeddedEntryPoint} entryPoint
   */
  init (entryPoint) {
    super.init(entryPoint);
    debug('initializing WebSocket Server with config: %a', entryPoint.config.websocket);

    if (!entryPoint.config.protocols.websocket.enabled) {
      return;
    }

    this.entryPoint = entryPoint;
    this.kuzzle = this.entryPoint.kuzzle;

    this.server = new WebSocketServer({
      server: entryPoint.httpServer,
      maxPayload: this.maxRequestSize,
      perMessageDeflate: false
    });

    this.server.on('connection', socket => this.onConnection(socket));
    this.server.on('error', error => this.onServerError(error));
  }

  onServerError(error) {
    this.kuzzle.pluginsManager.trigger('log:error', `[websocket] An error has occured "${error.message}":\n${error.stack}`);
  }

  onConnection(clientSocket) {
    const req = clientSocket.upgradeReq;

    if (req && req.url && req.url.startsWith('/socket.io/')) {
      // Discarding request management here: let socket.io protocol manage this connection
      return false;
    }

    let ips = [req && req.connection && req.connection.remoteAddress || clientSocket._socket.remoteAddress];
    if (req.headers['x-forwarded-for']) {
      ips = req.headers['x-forwarded-for']
        .split(',')
        .map(s => s.trim())
        .concat(ips);
    }

    const connection = new ClientConnection(this.protocol, ips, req.headers);
    debug('[%s] creating Websocket connection', connection.id);

    try {
      this.entryPoint.newConnection(connection);
    }
    catch (err) {
      this.entryPoint.log.warn('[websocket] Client connection refused with message "%s": initialization still underway', err.message);
      clientSocket.close(1013, err.message);
      return false;
    }

    this.connectionPool[connection.id] = {
      alive: true,
      socket: clientSocket,
      channels: []
    };

    clientSocket.on('close', () => {
      debug('[%s] receiving a `close` event', connection.id);
      this.onClientDisconnection(connection.id);
    });

    clientSocket.on('error', () => {
      debug('[%s] receiving a `error` event', connection.id);
      this.onClientDisconnection(connection.id);
    });

    clientSocket.on('message', data => {
      debug('[%s] receiving a `message` event', connection.id);
      this.onClientMessage(connection, data);
    });

    return true;
  }

  onClientDisconnection(clientId) {
    debug('[%s] onClientDisconnection', clientId);

    this.entryPoint.removeConnection(clientId);

    const connection = this.connectionPool[clientId];
    if (!connection) {
      return;
    }

    connection.alive = false;
    delete this.entryPoint.clients[connection.id];

    for (const channel of connection.channels) {
      if (this.channels[channel] && this.channels[channel].count > 1) {
        delete this.channels[channel][clientId];
        this.channels[channel].count--;
      }
      else {
        delete this.channels[channel];
      }
    }

    delete this.connectionPool[clientId];
  }

  onClientMessage(connection, data) {
    if (!data || !this.connectionPool[connection.id]) {
      return;
    }

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
      return this._send(connection.id, JSON.stringify(new BadRequestError(e.message)));
    }

    try {
      this.entryPoint.execute(new Request(parsed, {
        connectionId: connection.id,
        protocol: this.protocol,
        headers: connection.headers
      }), result => {
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

      this.entryPoint.kuzzle.pluginsManager.trigger('log:error', new KuzzleInternalError(e.message));

      return this._send(connection.id, JSON.stringify(errobj));
    }
  }

  broadcast(data) {
    /*
     Avoids stringifying the payload multiple times just to update the room:
     - we start deleting the last character, which is the closing JSON bracket ('}')
     - we then only have to inject the following string to each channel:
     ,"room":"<roomID>"}

     So, instead of stringifying the payload for each channel, we only concat
     a new substring to the original payload.
     */
    const payload = JSON.stringify(data.payload).slice(0, -1) + ',"room":"';

    debug('broadcast: %a', data);

    for (const channelId of data.channels) {
      if (this.channels[channelId]) {
        const
          channel = this.channels[channelId],
          channelPayload = payload + channelId + '"}';

        for (const connectionId of Object.keys(channel)) {
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

    const connection = this.connectionPool[connectionId];

    if (!connection || !connection.alive) {
      return;
    }

    if (!this.channels[channel]) {
      this.channels[channel] = {
        count: 0
      };
    }
    this.channels[channel][connectionId] = true;
    this.channels[channel].count++;
    connection.channels.push(channel);
  }

  leaveChannel(channel, connectionId) {
    debug('leaveChannel: %s %s', channel, connectionId);

    const connection = this.connectionPool[connectionId];

    if (!connection
      || !connection.alive
      || !this.channels[channel]
      || !this.channels[channel][connectionId]) {
      return;
    }

    if (this.channels[channel].count > 1) {
      delete this.channels[channel][connectionId];
      this.channels[channel].count--;
    }
    else {
      delete this.channels[channel];
    }

    const index = connection.channels.indexOf(channel);
    if (index !== -1) {
      connection.channels.splice(index, 1);
    }
  }

  disconnect(clientId, message = 'Connection closed by remote host') {
    debug('[%s] disconnect', clientId);

    if (this.connectionPool[clientId]) {
      this.connectionPool[clientId].socket.close(1011, message);
    }
  }

  _send (id, data) {
    debug('[%s] send: %a', id, data);

    const connection = this.connectionPool[id];

    if (connection && connection.alive && connection.socket.readyState === connection.socket.OPEN) {
      connection.socket.send(data);
    }
  }
}

module.exports = WebsocketProtocol;
