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

const Protocol = require('./protocol');
const ClientConnection = require('../clientConnection');
const debug = require('../../../util/debug')('kuzzle:entry-point:protocols:internal');

class InternalProtocol extends Protocol {
  constructor () {
    super();

    /**
     * List of connection by channel ID
     * @type {Map<string, Set<string>}
     */
    this.channels = new Map();

    /**
     * List of channels by connection ID
     * @type {Map<string, Set<string>}
     */
    this.connectionPool = new Map();
  }

  async init (entryPoint) {
    await super.init('internal', entryPoint);

    debug('initializing InternalProtocol');

    this.kuzzle.onAsk('core:network:protocols:internal:connect', () => {
      return this.addConnection();
    });

    this.kuzzle.onAsk('core:network:protocols:internal:disconnect', connectionId => {
      this.removeConnection(connectionId);
    });
  }

  addConnection () {
    const connection = new ClientConnection(this.name, ['127.0.0.1']);

    this.entryPoint.newConnection(connection);

    this.connectionPool.set(connection.id, new Set());

    return connection.id;
  }

  removeConnection (connectionId) {
    debug('[%s] Client disconnected', connectionId);

    this.entryPoint.removeConnection(connectionId);

    const channels = this.connectionPool.get(connectionId);

    if (! channels) {
      return;
    }

    for (const channel of channels) {
      const connectionIds = this.channels.get(channel);

      if (connectionIds) {
        connectionIds.delete(connectionId);

        if (connectionIds.size === 0) {
          this.channels.delete(channel);
        }
      }
    }

    this.connectionPool.delete(connectionId);
  }

  joinChannel (channel, connectionId) {
    debug('joinChannel: %s %s', channel, connectionId);

    let channelIds = this.connectionPool.get(connectionId);

    if (! channelIds) {
      return;
    }

    if (! channelIds) {
      channelIds = new Set([channel]);
      this.connectionPool.set(connectionId, channelIds);
    }
    else {
      channelIds.add(channel);
    }

    let connectionIds = this.channels(channel);

    if (! connectionIds) {
      connectionIds = new Set([connectionId]);
      this.channels.set(channel, connectionIds)
    }
    else {
      connectionIds.add(connectionId);
    }
  }

  leaveChannel (channel, connectionId) {
    debug('leaveChannel: %s %s', channel, connectionId);

    const channelIds = this.connectionPool.get(connectionId);
    const connectionIds = this.channels.get(channel);

    if (! channelIds || ! connectionIds || ! connectionIds.has(connectionId)) {
      return;
    }

    connectionIds.delete(connectionId);

    if (connectionIds.size === 0) {
      this.channels.delete(channel);
    }

    channelIds.delete(channel);
  }

  disconnect (connectionId) {
    debug('[%s] disconnect', connectionId);

    this.entryPoint.removeConnection(connectionId);

    const channelIds = this.connectionPool.get(connectionId);

    if (! channelIds) {
      return;
    }

    for (const channel of channelIds) {
      const connectionIds = this.channels.get(channel);

      if (connectionIds) {
        connectionIds.delete(connectionId);

        if (connectionIds.size === 0) {
          this.channels.delete(channel);
        }
      }
    }

    this.connectionPool.delete(connectionId);
  }

  broadcast (data) {
    debug('broadcast: %a', data);

    const payload = data.payload;

    for (let i = 0; i < data.channels.length; i++) {
      const connectionIds = this.channels.get(data.channels[i]);

      payload.room = data.channels[i];

      if (! connectionIds) {
        continue;
      }

      for (let i = 0; i < connectionIds.length; i++) {
        this.kuzzle.emit(
          `core:network:protocols:internal:message:${data.connectionId}`,
          payload);
        }
    }
  }

  notify (data) {
    debug('notify: %a', data);

    const payload = data.payload;

    for (let i = 0; i < data.channels.length; i++) {
      payload.room = data.channels[i];

      this.kuzzle.emit(
        `core:network:protocols:internal:message:${data.connectionId}`,
        payload);
    }
  }

}
