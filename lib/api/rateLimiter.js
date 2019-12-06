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

class RateLimiter {
  constructor (kuzzle) {
    this.limits = Object.assign({}, kuzzle.config.limits.requestsRate);
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
   * @param  {Request}  request
   * @return {Boolean}
   */
  isAllowed (request) {

console.dir(request.context.connection)
    if (request.input.controller === 'auth' && request.input.action === 'login') {
      const cid = request.context.connection.id;

      this.frame[cid] = (this.frame[cid] || 0) + 1;
    }
    else {
      const userId = request.context.user._id;
      this.frame[userId] = (this.frame[userId] || 0) + 1;
      if (userId === '-1') { // anonymous user
        // if (this.frame[userId] > this.limits.anonymous)
      }
    }

    return true;
  }
}

module.exports = RateLimiter;
