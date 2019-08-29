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

const
  Elasticsearch = require('./elasticsearch'),
  Redis = require('./redis');

class Services {

  constructor (kuzzle) {
    // Restricted storage engine for kuzzle internal index ('%kuzzle')
    this.internalStorage = new Elasticsearch(
      kuzzle,
      kuzzle.config.services.db,
      'internal');

    // Redis cache engine for internal usage (indexCache, scrollId, etc.)
    this.internalCache = new Redis(kuzzle, kuzzle.config.services.internalCache);

    // Storage engine for public indexes only (prefixed by '&')
    this.publicStorage = new Elasticsearch(
      kuzzle,
      kuzzle.config.services.db,
      'public');

    // Redis cache engine for public usage (ms controller)
    this.publicCache = new Redis(kuzzle, kuzzle.config.services.memoryStorage);
  }

  init () {
    return Bluebird.race([
      this.internalStorage.init(),
      this.internalCache.init(),
      this.publicStorage.init(),
      this.publicCache.init()
    ]);
  }
}

module.exports = Services;
