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

/**
 * Wrapper around the document store.
 * Once instantiated, this class can only access the index passed in the
 * constructor
 */
class Store {
  /**
   * @param {Kuzzle} kuzzle
   * @param {String} index
   * @param {storeScopeEnum} scope
   */
  constructor (kuzzle, index, scope) {
    this.kuzzle = kuzzle;
    this.index = index;
    this.scope = scope;

    const methodsMapping = {
      count:              `core:store:${scope}:document:count`,
      create:             `core:store:${scope}:document:create`,
      createCollection:   `core:store:${scope}:collection:create`,
      createOrReplace:    `core:store:${scope}:document:createOrReplace`,
      delete:             `core:store:${scope}:document:delete`,
      deleteByQuery:      `core:store:${scope}:document:deleteByQuery`,
      deleteCollection:   `core:store:${scope}:collection:delete`,
      deleteIndex:        `core:store:${scope}:index:delete`,
      exists:             `core:store:${scope}:document:exist`,
      get:                `core:store:${scope}:document:get`,
      getMapping:         `core:store:${scope}:mappings:get`,
      mExecute:           `core:store:${scope}:document:mExecute`,
      mGet:               `core:store:${scope}:document:mGet`,
      refreshCollection:  `core:store:${scope}:collection:refresh`,
      replace:            `core:store:${scope}:document:replace`,
      scroll:             `core:store:${scope}:document:scroll`,
      search:             `core:store:${scope}:document:search`,
      truncateCollection: `core:store:${scope}:collection:truncate`,
      update:             `core:store:${scope}:document:update`,
      updateByQuery:      `core:store:${scope}:document:updateByQuery`,
      updateCollection:   `core:store:${scope}:collection:update`,
      updateMapping:      `core:store:${scope}:mappings:update`,
    };

    for (const [method, event] of Object.entries(methodsMapping)) {
      this[method] = (...args) => this.kuzzle.ask(event, this.index, ...args);
    }
  }

  /**
   * Initialize the index, and creates provided collections
   *
   * @param {Object} collections - List of collections with mappings to create
   *
   * @returns {Promise}
   */
  async init (collections = {}) {
    await this.createCollections(collections);
  }

  /**
   * Creates collections with the provided mappings
   *
   * @param {Object} collections - collections with mappings
   *
   * @returns {Promise}
   */
  createCollections (collections) {
    return Bluebird.map(
      Object.entries(collections),
      ([collection, mappings]) => {
        return this.kuzzle.ask(
          `core:store:${this.scope}:collection:create`,
          this.index,
          collection,
          { mappings });
      });
  }
}

module.exports = Store;
