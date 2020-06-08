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

/**
 * Internal protocol to use SDK realtime subscription from plugins.
 *
 * This protocol only use one connection. This connection is always open.
 *
 * Messages to the embedded SDK are dispatched with the following event:
 *  - 'core:network:protocols:internal:message'
 */
class InternalProtocol extends Protocol {
  static get name () {
    return 'internal';
  }

  constructor () {
    super();

    /**
     * List of channel IDs
     * @type {Set<string>}
     */
    this.channels = new Set();

    this.name = 'internal';

    this.connection = new ClientConnection(this.name, ['127.0.0.1']);
  }

  async init (entryPoint) {
    await super.init('internal', entryPoint);

    debug('initializing InternalProtocol');

    this.entryPoint.newConnection(this.connection);

    this.kuzzle.onAsk('core:network:protocols:internal:connectionId', () => (
      this.connection.id
    ));
  }

  joinChannel (channel, connectionId) {
    debug('joinChannel: %s %s', channel, connectionId);

    this.channels.add(channel);
  }

  leaveChannel (channel, connectionId) {
    debug('leaveChannel: %s %s', channel, connectionId);

    this.channels.delete(channel);
  }

  disconnect (connectionId) {
    // Never happen, the InternalProtocol always keep his only connection open
  }

  broadcast (data) {
    debug('broadcast: %a', data);

    const payload = data.payload;

    for (let i = 0; i < data.channels.length; i++) {
      payload.room = data.channels[i];

      this.kuzzle.emit('core:network:protocols:internal:message', payload);
    }
  }

  notify (data) {
    debug('notify: %a', data);

    const payload = data.payload;

    for (let i = 0; i < data.channels.length; i++) {
      payload.room = data.channels[i];

      this.kuzzle.emit('core:network:protocols:internal:message', payload);
    }
  }

}

module.exports = InternalProtocol;