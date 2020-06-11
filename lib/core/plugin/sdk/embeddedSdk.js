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

const { Kuzzle: KuzzleSDK } = require('kuzzle-sdk');

const FunnelProtocol = require('./funnelProtocol');
const { isPlainObject } = require('../../../util/safeObject');
const kerror = require('../../../kerror');

const contextError = kerror.wrap('plugin', 'context');

/**
 * Kuzzle embedded SDK to make API calls inside applications or plugins.
 */
class EmbeddedSDK extends KuzzleSDK {
  /**
   * @param {Kuzzle} kuzzle - Kuzzle object
   * @param {User} [user] - User to impersonate the SDK with
   */
  constructor (kuzzle, user) {
    super(new FunnelProtocol(kuzzle, user), { autoResubscribe: false });

    Reflect.defineProperty(this, '_kuzzle', {
      value: kuzzle
    });
  }

  /**
   * Returns a new SDK impersonated with the provided user.
   *
   * @param {User} user - User to impersonate the SDK with
   *
   * @returns {EmbeddedSDK}
   */
  as (user) {
    if (! isPlainObject(user) || typeof user._id !== 'string') {
      throw contextError.get('invalid_user');
    }

    return new EmbeddedSDK(this._kuzzle, user);
  }

  /**
   * Sends an API request to Kuzzle.
   *
   * This is a low-level method, exposed to allow advanced SDK users to bypass
   * high-level methods.
   *
   * @param {Object} request - API request (https://docs.kuzzle.io/core/2/api/essentials/query-syntax/#other-protocols)
   * @param {Object} [options] - Optional arguments
   * @returns {Promise<Object>}
   */
  query (request, options = {}) {
    // By default, do not propagate realtime notification accross cluster nodes
    if ( isPlainObject(request)
      && request.controller === 'realtime'
      && request.action === 'subscribe'
    ) {
      request.replicate = options.replicate === undefined
        ? false
        : options.replicate;

      if (request.replicate === false && this.kuzzle.started && process.env.NODE_ENV !== 'production') {
        this.kuzzle.log.warn('A realtime subscription without "replicate: true" has been made after Kuzzle has started.\nEnsure to pass "replicate: true" when subscribing in hooks, pipes or controller actions.\nSee https://docs.kuzzle.io/core/2/plugins/plugin-context/accessors/sdk/#realtime-notifications for more infos.');
      }
    }

    return super.query(request, options);
  }
}

module.exports = EmbeddedSDK;
