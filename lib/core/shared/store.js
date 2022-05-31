/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

const { Mutex } = require('../../util/mutex');
const { promiseAllN } = require('../../util/async');
const kerror = require('../../kerror');
const { getESIndexDynamicSettings } = require('../../util/esRequest');

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

    // the scroll and multiSearch method are special: they doesn't need an index parameter
    // we keep them for ease of use
    this.scroll = (scrollId, opts) => global.kuzzle.ask(
      `core:storage:${scope}:document:scroll`,
      scrollId,
      opts);

    this.multiSearch = (targets, searchBody, opts) => global.kuzzle.ask(
      `core:storage:${scope}:document:multiSearch`,
      targets,
      searchBody,
      opts
    );
  }

  /**
   * Initialize the index, and creates provided collections
   *
   * @param {Object} collections - List of collections with mappings to create
   *
   * @returns {Promise}
   */
  async init (collections = {}) {
    const creatingMutex = new Mutex(`Store.init(${this.index})`, {
      timeout: 0,
      ttl: 30000,
    });

    const creatingLocked = await creatingMutex.lock();

    if (creatingLocked) {
      try {
        await this.createCollections(collections, {
          indexCacheOnly: false
        });
      }
      finally {
        await creatingMutex.unlock();
      }
    }
    else {
      // Ensure that cached collection are used after being properly
      // created by a kuzzle cluster
      const cachingMutex = new Mutex(`Store.init(${this.index})`, {
        timeout: -1,
        ttl: 30000,
      });

      await cachingMutex.lock();
      cachingMutex.unlock();

      await this.createCollections(collections, {
        indexCacheOnly: true
      });
    }
  }

  /**
   * Creates collections with the provided mappings
   *
   * @param {Object} collections - collections with mappings
   *
   * @returns {Promise}
   */
  createCollections (
    collections,
    { indexCacheOnly = false } = {}
  ) {
    return promiseAllN(
      Object.entries(collections).map(
        ([collection, config]) => async () => {
          // @deprecated
          if (! (config.mappings !== undefined && config.settings !== undefined)) {
            // @deprecated
            return global.kuzzle.ask(
              `core:storage:${this.scope}:collection:create`,
              this.index,
              collection,
              { mappings: config },
              { indexCacheOnly });
          }

          // @deprecated
          const isConfigDeprecated = config.settings.number_of_shards === undefined && config.settings.number_of_replicas === undefined;

          if (indexCacheOnly) {
            return global.kuzzle.ask(
              `core:storage:${this.scope}:collection:create`,
              this.index,
              collection,
              // @deprecated
              isConfigDeprecated ? { mappings: config.mappings } : config,
              { indexCacheOnly });
          }

          const exist = await global.kuzzle.ask(
            `core:storage:${this.scope}:collection:exist`,
            this.index,
            collection);

          if (exist) {
            // @deprecated
            const dynamicSettings = isConfigDeprecated
              ? null
              : getESIndexDynamicSettings(config.settings);

            const existingSettings = await global.kuzzle.ask(
              `core:storage:${this.scope}:collection:settings:get`,
              this.index,
              collection);

            if (! isConfigDeprecated
              && parseInt(existingSettings.number_of_shards) !== config.settings.number_of_shards
            ) {
              if (global.NODE_ENV === 'development') {
                throw kerror.get(
                  'storage',
                  'wrong_collection_number_of_shards',
                  collection,
                  this.index,
                  this.scope,
                  'number_of_shards',
                  config.settings.number_of_shards,
                  existingSettings.number_of_shards);
              }
              global.kuzzle.log.warn(`Attempt to recreate an existing collection ${collection} of index ${this.index} of scope ${this.scope} with non matching static setting : number_of_shards at ${config.settings.number_of_shards} while existing one is at ${existingSettings.number_of_shards}`);
            }

            return global.kuzzle.ask(
              `core:storage:${this.scope}:collection:create`,
              this.index,
              collection,
              // @deprecated
              isConfigDeprecated
                ? { mappings: config.mappings }
                : { mappings: config.mappings, settings: dynamicSettings },
              { indexCacheOnly: true }
            );
          }

          return global.kuzzle.ask(
            `core:storage:${this.scope}:collection:create`,
            this.index,
            collection,
            // @deprecated
            isConfigDeprecated ? { mappings: config.mappings } : config,
            { indexCacheOnly });
        }
      ), 10
    );
  }
}

module.exports = Store;
