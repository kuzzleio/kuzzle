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

const assert = require('assert');
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
   * @param {storageScopeEnum} scope
   */
  constructor (kuzzle, index, scope) {
    this._index = index;
    this._kuzzle = kuzzle;
    this._bootstrap = null;

    const methodsMapping = {
      count:              `core:store:${scope}:document:count`,
      create:             `core:store:${scope}:document:create`,
      createCollection:   `core:store:${scope}:collection:create`,
      createOrReplace:    `core:store:${scope}:document:write`,
      delete:             `core:store:${scope}:document:delete`,
      deleteByQuery:      `core:store:${scope}:document:deleteByQuery`,
      deleteCollection:   `core:store:${scope}:collection:delete`,
      deleteIndex:        `core:store:${scope}:index:delete`,
      exists:             `core:store:${scope}:document:exist`,
      get:                `core:store:${scope}:document:get`,
      getMapping:         `core:store:${scope}:mapping:get`,
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
      updateMapping:      `core:store:${scope}:mapping:update`,
    };

    for (const [method, event] of methodsMapping) {
      this[method] = (...args) => this._kuzzle.ask(event, this.index, ...args);
    }
  }

  get index () {
    return this._index;
  }

  get bootstrap () {
    return this._bootstrap;
  }

  set bootstrap (indexBootstrap) {
    assert(
      indexBootstrap instanceof require('./storeBootstrap'),
      'IndexStorage bootstrap must be an instance of StoreBootstrap');

    this._bootstrap = indexBootstrap;
  }

  /**
   * Initialize the index, creates provided collections and call the provided boostrap
   *
   * @param {Object} collections - List of collections with mappings to create
   *
   * @returns {Promise}
   */
  async init (collections = {}) {
    await this.createCollections(collections);

    if (this._bootstrap) {
      await this._bootstrap.startOrWait();
    }
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
        return this._kuzzle.ask(
          'core:store:collection:create',
          this._index,
          collection,
          { mappings });
      });
  }
}

module.exports = Store;
