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

const { Mutex } = require('../../util/mutex');

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
  constructor (index, scope) {
    this.index = index;
    this.scope = scope;

    const methodsMapping = {
      count: `core:storage:${scope}:document:count`,
      create: `core:storage:${scope}:document:create`,
      createCollection: `core:storage:${scope}:collection:create`,
      createOrReplace: `core:storage:${scope}:document:createOrReplace`,
      delete: `core:storage:${scope}:document:delete`,
      deleteByQuery: `core:storage:${scope}:document:deleteByQuery`,
      deleteCollection: `core:storage:${scope}:collection:delete`,
      deleteFields: `core:storage:${scope}:document:deleteFields`,
      deleteIndex: `core:storage:${scope}:index:delete`,
      exists: `core:storage:${scope}:document:exist`,
      get: `core:storage:${scope}:document:get`,
      getMapping: `core:storage:${scope}:mappings:get`,
      mExecute: `core:storage:${scope}:document:mExecute`,
      mGet: `core:storage:${scope}:document:mGet`,
      refreshCollection: `core:storage:${scope}:collection:refresh`,
      replace: `core:storage:${scope}:document:replace`,
      search: `core:storage:${scope}:document:search`,
      truncateCollection: `core:storage:${scope}:collection:truncate`,
      update: `core:storage:${scope}:document:update`,
      updateByQuery: `core:storage:${scope}:document:updateByQuery`,
      updateCollection: `core:storage:${scope}:collection:update`,
      updateMapping: `core:storage:${scope}:mappings:update`,
    };

    for (const [method, event] of Object.entries(methodsMapping)) {
      this[method] = (...args) => global.kuzzle.ask(event, this.index, ...args);
    }

    // the scroll method is special: it doesn't need an index parameter
    // we keep it for ease of use
    this.scroll = (scrollId, opts) => global.kuzzle.ask(
      `core:storage:${scope}:document:scroll`,
      scrollId,
      opts);
  }

  /**
   * Initialize the index, and creates provided collections
   *
   * @param {Object} collections - List of collections with mappings to create
   *
   * @returns {Promise}
   */
  async init (collections = {}) {
    const mutex = new Mutex(`Store.init(${this.index})`, {
      timeout: -1,
      ttl: 30000,
    });

    await mutex.lock();

    try {
      await this.createCollections(collections);
    }
    finally {
      await mutex.unlock();
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
        return global.kuzzle.ask(
          `core:storage:${this.scope}:collection:create`,
          this.index,
          collection,
          { mappings });
      },
      { concurrency: 10 });
  }
}

module.exports = Store;
