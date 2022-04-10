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

class FunnelProtocol extends KuzzleEventEmitter {
  constructor () {
    super();

    this.id = 'funnel';
    this.connectionId = null;

    /**
     * Realtime notifications are sent by the InternalProtocol
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
    if (! this.connectionId) {
      this.connectionId = await global.kuzzle.ask('core:network:internal:connectionId:get');
    }

    const requestOptions = {
      connection: {
        id: this.connectionId,
        protocol: this.id
      },
      user: null,
    };

    // Validate and use the provided request.kuid
    if (request.__kuid__) {
      if (typeof request.__kuid__ !== 'string') {
        throw kerror.get('plugin', 'context', 'invalid_user');
      }
      // Get the user and store it in this context to prevent any possible race conditions
      requestOptions.user = await global.kuzzle.ask('core:security:user:get', request.__kuid__);
    }

    const kuzzleRequest = new Request(request, requestOptions);

    if (requestOptions.user && request.__checkRights__
      && ! await requestOptions.user.isActionAllowed(kuzzleRequest)
    ) {
      throw kerror.get(
        'security',
        'rights',
        'forbidden',
        kuzzleRequest.input.controller,
        kuzzleRequest.input.action,
        requestOptions.user._id);
    }

    return global.kuzzle.funnel.executePluginRequest(kuzzleRequest);
  }
}

module.exports = FunnelProtocol;
