/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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

const Bluebird = require('bluebird');

/**
 *
 * @param {Kuzzle} kuzzle
 * @param {InternalEngine} engine
 * @constructor
 */
class PluginInternalEngineBootstrap {
  constructor(kuzzle, engine) {
    this.kuzzle = kuzzle;
    this.db = engine;
  }

  /**
   * Bootstraps Plugin storage engine
   * Creates the internal index and collections if needed
   *
   * @returns {Promise.<T>}
   */
  all (collections) {
    return this.db.createInternalIndex()
      .then(() => this.createCollections(collections))
      .then(() => this.db.refresh())
      .then(() => Bluebird.resolve(this.kuzzle.indexCache.add(this.db.index)))
      .catch(error => {
        // plugin manager is initializing, cannot use the logger
        console.error(error, error.stack);  // eslint-disable-line no-console
        throw error;
      });
  }

  createCollection (collection, collectionMapping) {
    return this.db.updateMapping(collection, collectionMapping);
  }

  createCollections (collections) {
    const promises = [Bluebird.resolve()];

    Object.keys(collections).forEach(collection => {
      promises.push(this.createCollection(collection, collections[collection]));
    });

    return Bluebird.all(promises);
  }
}

module.exports = PluginInternalEngineBootstrap;
