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
    this.requestOptions = null;
    this._impersonateKuid = null;

    if (user) {
      if (typeof user._id !== 'string') {
        throw kerror.get('plugin', 'context', 'invalid_user');
      }
      this._impersonateKuid = user._id;
    }

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

  async _impersonate (requestedKuid) {
    if (typeof requestedKuid !== 'string') {
      throw kerror.get('plugin', 'context', 'invalid_user');
    }

    // Make sure to request the user only if needed
    if (! this.requestOptions.user || this.requestOptions.user._id !== requestedKuid) {
      this.requestOptions.user = await global.kuzzle.ask('core:security:user:get', requestedKuid);
    }
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
        user: null
      };
    }

    // Use the provided request.UserId, otherwise use the impersonatedId previously given at funnel construction
    if (request.__kuid__) {
      await this._impersonate(request.__kuid__);
    }
    else if (this._impersonateKuid) { // Funnel can also be initialized without an impersonatedId
      await this._impersonate(this._impersonateKuid);
    }
    else { // Reset user if impersonation is not required
      this.requestOptions.user = null;
    }

    const kuzzleRequest = new Request(request, this.requestOptions);

    try {
      if (this.requestOptions.user && ! await this.requestOptions.user.isActionAllowed(kuzzleRequest)) {
        throw kerror.get(
          'security',
          'rights',
          'forbidden',
          kuzzleRequest.input.controller,
          kuzzleRequest.input.action,
          this.requestOptions.user._id);
      }

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
