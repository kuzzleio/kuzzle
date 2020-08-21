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

const CacheEngine = require('./cache/cacheEngine');
const StorageEngine = require('./storage/storageEngine');
const SecurityModule = require('./security');
const RealtimeModule = require('./realtime');

// Core modules starter
async function init (kuzzle) {
  const modules = [
    new CacheEngine(kuzzle),
    new StorageEngine(kuzzle),
    new SecurityModule(kuzzle),
    new RealtimeModule(kuzzle),
  ];

  await Bluebird.mapSeries(modules, module => module.init());
}

module.exports = { init };
