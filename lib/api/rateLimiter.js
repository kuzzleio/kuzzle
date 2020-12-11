/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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

const Kuzzle = require('../kuzzle/kuzzle');

class RateLimiter {
  constructor () {
    this.kuzzle = Kuzzle.getInstance();
    this.loginsPerSecond = this.kuzzle.config.limits.loginsPerSecond;
    this.frame = {};
    this.frameResetTimer = null;
  }

  init () {
    this.frameResetTimer = setInterval(() => ( this.frame = {} ), 1000);
  }

  /**
   * Return a boolean indicating whether a request execution is allowed as per
   * the rate restriction configuration.
   *
   * auth:login is limited by the limits.loginsPerSecond configuration
   * auth:logout is NOT limited for authenticated users
   *
   * @param  {Request}  request
   * @returns {Boolean}
   */
  async isAllowed (request) {
    const { controller, action } = request.input;
    let count = 0;
    let limit = -1;

    if (controller === 'auth' && action === 'login') {
      const cid = request.context.connection.id;

      count = this.frame[cid] = (this.frame[cid] || 0) + 1;
      limit = this.loginsPerSecond;
    }
    else {
      const { _id, profileIds } = request.context.user;

      // By definition, auth:logout should be unrestricted
      if (_id !== '-1' && controller === 'auth' && action === 'logout') {
        return true;
      }

      const profiles = await this.kuzzle.ask(
        'core:security:profile:mGet',
        profileIds);

      for (let i = 0; i < profiles.length; i++) {
        const { rateLimit = 0 } = profiles[i];

        if (limit === 0 || rateLimit === 0) {
          limit = 0;
        }
        else {
          limit = Math.max(limit, rateLimit);
        }
      }

      if (limit > 0) {
        count = this.frame[_id] = (this.frame[_id] || 0) + 1;
      }
    }

    return limit === 0 || count <= limit;
  }
}

module.exports = RateLimiter;
