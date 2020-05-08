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

const Bluebird = require('bluebird');
const Redis = require('../../services/cache/redis');

class CacheEngine {
  constructor (kuzzle) {
    this._memoryStorage = new Redis(kuzzle, kuzzle.config.services.memoryStorage);
    this._internalCache = new Redis(kuzzle, kuzzle.config.services.internalCache);
  }

  get public () {
    return this._memoryStorage;
  }

  get internal () {
    return this._internalCache;
  }

  /**
   * Initialize the redis clients
   *
   * @returns {Promise}
   */
  async init () {
    const promises = [];

    promises.push(this._memoryStorage.init());
    promises.push(this._internalCache.init());

    await Bluebird.all(promises);
  }
}

module.exports = CacheEngine;
