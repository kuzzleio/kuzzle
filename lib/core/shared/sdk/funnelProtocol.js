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

const { KuzzleEventEmitter } = require('kuzzle-sdk');

const { Request } = require('../../../api/request');
const kerror = require('../../../kerror');
const { hilightUserCode } = require('../../../util/stackTrace');

class FunnelProtocol extends KuzzleEventEmitter {
  constructor(user = null) {
    super();

    this.id = 'funnel';
    this.user = user;

    this.requestOptions = null;

    if (this.user && typeof this.user._id !== 'string') {
      throw kerror.get('plugin', 'context', 'invalid_user');
    }

    /**
     * Realtime notifications are sended by the InternalProtocol
     * through the internal event system.
     */
    global.kuzzle.on('core:network:internal:message', message => {
      // Send the notifications to the SDK for the internal Room mechanism
      this.emit(message.room, message);
    });
  }

  isReady () {
    return true;
  }

  /**
   *  Hydrate the user and execute SDK query
   */
  async query (request) {
    if (! this.requestOptions) {
      this.requestOptions = {
        connection: {
          id: await global.kuzzle.ask('core:network:internal:connectionId:get'),
          protocol: this.id
        },
        user: this.user
      };
    }

    const kuzzleRequest = new Request(request, this.requestOptions);

    try {
      const result = await global.kuzzle.funnel.executePluginRequest(kuzzleRequest);

      return { result };
    }
    catch (error) {
      if (error.stack) {
        error.stack = error.stack.split('\n').map(hilightUserCode).join('\n');
      }

      throw error;
    }
  }
}

module.exports = FunnelProtocol;
