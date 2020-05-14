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

const
  { Request } = require('kuzzle-common-objects'),
  kerror = require('../../kerror'),
  { KuzzleEventEmitter } = require('kuzzle-sdk');

class FunnelProtocol extends KuzzleEventEmitter {
  constructor(funnel, user = null) {
    super();

    this.funnel = funnel;
    this.id = 'funnel';
    this.user = user;

    if (this.user && typeof this.user._id !== 'string') {
      throw kerror.get('plugin', 'context', 'invalid_user');
    }
  }

  isReady () {
    return true;
  }

  /**
   *  Hydrate the user and execute SDK query
   */
  async query (request) {
    const kuzzleRequest = new Request(request, {
      connection: { protocol: 'funnel' },
      user: this.user
    });

    if ( kuzzleRequest.input.controller === 'realtime'
      && ['subscribe', 'unsubscribe'].includes(kuzzleRequest.input.action)
    ) {
      throw kerror.get(
        'plugin',
        'context',
        'unavailable_realtime',
        kuzzleRequest.input.action);
    }

    const result = await this.funnel.executePluginRequest(kuzzleRequest);

    return { result };
  }
}

module.exports = FunnelProtocol;
