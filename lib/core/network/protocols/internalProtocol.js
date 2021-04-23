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

const debug = require('../../../util/debug')('kuzzle:network:protocols:internal');

/**
 * Internal protocol to use SDK realtime subscription from plugins.
 *
 * This protocol only use one connection. This connection is always open.
 *
 * Messages to the embedded SDK are dispatched with the following event:
 *  - 'core:network:internal:message'
 */
class InternalProtocol extends Protocol {
  constructor () {
    super('internal');

    this.connection = new ClientConnection(this.name, ['127.0.0.1']);

    /**
     * List of channel IDs
     * @type {Set<string>}
     */
    this.channels = new Set();
  }

  async init (entryPoint) {
    await super.init(null, entryPoint);

    debug('initializing InternalProtocol');

    this.entryPoint.newConnection(this.connection);

    /**
     * Returns the internal connection ID used by the protocol.
     *
     * @returns {string} connectionId
     */
    global.kuzzle.onAsk('core:network:internal:connectionId:get', () => (
      this.connection.id
    ));
  }

  joinChannel (channel, connectionId) {
    debug('joinChannel: %s', channel, connectionId);

    this.channels.add(channel);
  }

  leaveChannel (channel, connectionId) {
    debug('leaveChannel: %s', channel, connectionId);

    this.channels.delete(channel);
  }

  disconnect (connectionId) {
    debug('disconnect: %s', connectionId);

    // Never happens, the InternalProtocol always keep his only connection open
  }

  broadcast (data) {
    debug('broadcast: %a', data);

    this._send(data);
  }

  notify (data) {
    debug('notify: %a', data);

    this._send(data);
  }

  _send (data) {
    for (let i = 0; i < data.channels.length; i++) {
      const message = { ...data.payload, room: data.channels[i] };

      global.kuzzle.emit('core:network:internal:message', message);
    }
  }
}

module.exports = InternalProtocol;
