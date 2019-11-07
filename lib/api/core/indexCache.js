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
  Bluebird = require('bluebird'),
  Request = require('kuzzle-common-objects').Request,
  _ = require('lodash');

/**
 * @deprecated
 * Index/collection cache management
 */
class IndexCache {
  constructor (kuzzle) {
    this.indexes = new Map();
    this.defaultMappings = new Map();

    this.kuzzle = kuzzle;
    this.commonMapping = this.kuzzle.config.services.db.commonMapping;
    this.dynamic = this.kuzzle.config.services.db.dynamic;
  }

  initInternal (internalEngine) {
    return internalEngine.getMapping()
      .then(mapping => {
        for (const index of Object.keys(mapping)) {
          this.indexes.set(index, new Set(Object.keys(mapping[index].mappings)));
        }
      });
  }

  init () {
    const internalEngine = this.kuzzle.internalEngine;

    return internalEngine.listIndexes()
      .then(indexes =>
        indexes.filter(index => index !== this.kuzzle.internalEngine.index))
      .then(indexes => {
        const promises = [];

        for (const index of indexes) {
          this.indexes.set(index, new Set());
          this.defaultMappings.set(index, _.cloneDeep(this.commonMapping));

          promises.push(
            internalEngine.listCollections(index)
              .then(collections => {
                const applyMappingPromises = [];

                for (const collection of collections) {
                  this.indexes.get(index).add(collection);

                  applyMappingPromises.push(
                    this.kuzzle.internalEngine.applyDefaultMapping(
                      index,
                      collection,
                      this.defaultMappings.get(index)));
                }

                return Promise.all(applyMappingPromises);
              })
              .then(defaultMappings => {
                // We are working on the same index so the returned mappings
                // are all the same
                this.defaultMappings.set(index, defaultMappings[0]);
              })
          );
        }

        return Bluebird.all(promises);
      })
      .then(() => internalEngine.listAliases())
      .then(aliases => {
        for (const alias of Object.keys(aliases)) {
          const original = aliases[alias];
          this.indexes.set(alias, this.indexes.get(original));
          this.defaultMappings.set(alias, this.defaultMappings.get(original));
        }
      });
  }

  add (index, collection, notify = true) {
    let modified = false;

    if (index !== undefined) {
      let cachedCollections = this.indexes.get(index);

      if (!cachedCollections) {
        cachedCollections = new Set();
        this.indexes.set(index, cachedCollections);
        modified = true;
      }

      if (collection && !cachedCollections.has(collection)) {
        cachedCollections.add(collection);
        modified = true;
      }
    }

    if (notify && modified) {
      this.kuzzle.emit('core:indexCache:add', {index, collection});
    }

    return modified;
  }

  /**
   * Test if an index or a collection exists in Kuzzle cache.
   * If not, send a request to ask ElasticSearch and then update the cache accordingly.
   *
   * @param {string} index
   * @param {string} collection
   * @param {boolean} hotReload (default: true) - If true, query Elasticsearch to update cache
   * @returns {Promise<boolean>}
   */
  exists (index, collection, hotReload = true) {
    if (collection === undefined) {
      return this._indexExists(index, hotReload);
    }

    return this._indexExists(index, hotReload)
      .then(exists => {
        if (! exists) {
          return false;
        }

        return this._collectionExists(index, collection, hotReload);
      });
  }

  remove (index, collection, notify = true) {
    let modified = false;
    const collections = this.indexes.get(index);

    if (index && collections) {
      if (collection) {
        modified = collections.delete(collection);
      }
      else {
        this.indexes.delete(index);
        modified = true;
      }
    }

    if (notify && modified) {
      this.kuzzle.emit('core:indexCache:remove', {index, collection});
    }

    return modified;
  }

  reset (index, notify = true) {
    if (index !== undefined) {
      this.indexes.set(index, new Set());
    }
    else {
      this.indexes.clear();
    }

    if (notify) {
      this.kuzzle.emit('core:indexCache:reset', {index});
    }
  }

  _indexExists (index, hotReload) {
    if (this.indexes.has(index)) {
      return Bluebird.resolve(true);
    }
    else if (! hotReload) {
      return Bluebird.resolve(false);
    }

    const request = new Request({ index });

    return this.kuzzle.services.list.storageEngine.indexExists(request)
      .then(indexExists => {
        if (! indexExists) {
          return false;
        }

        return this.add(index, null, true);
      });
  }

  _collectionExists (index, collection, hotReload) {
    if (this.indexes.get(index).has(collection)) {
      return Bluebird.resolve(true);
    }
    else if (! hotReload) {
      return Bluebird.resolve(false);
    }

    const request = new Request({ index, collection });

    return this.kuzzle.services.list.storageEngine.collectionExists(request)
      .then(collectionExists => {
        if (! collectionExists) {
          return false;
        }

        if (!this.defaultMappings.has(index)) {
          this.defaultMappings.set(index, _.cloneDeep(this.commonMapping));
        }

        return this.kuzzle.internalEngine.applyDefaultMapping(index, collection, this.defaultMappings.get(index))
          .then(() => this.add(index, collection, true));
      });
  }
}

module.exports = IndexCache;
