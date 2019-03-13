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
 * Index/collection cache management
 */
class IndexCache {

  constructor (kuzzle) {
    this.indexes = {};
    this.defaultMappings = {};

    this.kuzzle = kuzzle;
    this.commonMapping = this.kuzzle.config.services.db.commonMapping;
    this.dynamic = this.kuzzle.config.services.db.dynamic;
  }

  initInternal (internalEngine) {
    return internalEngine.getMapping()
      .then(mapping => {
        for (const index of Object.keys(mapping)) {
          this.indexes[index] = Object.keys(mapping[index].mappings);
        }
      });
  }

  init () {
    const internalEngine = this.kuzzle.internalEngine;

    return internalEngine.listIndexes()
      .then(indexes => indexes.filter(index => index !== this.kuzzle.internalEngine.index))
      .then(indexes => {
        const promises = [];

        for (const index of indexes) {
          this.indexes[index] = [];
          this.defaultMappings[index] = _.cloneDeep(this.commonMapping);

          promises.push(internalEngine.listCollections(
            index
          )
            .then(collections => {
              for (const collection of collections) {
                promises.push(this._applyDefaultMapping(index, collection));
              }

              return null;
            })
          );
        }

        return Bluebird.all(promises);
      })
      .then(() => internalEngine.listAliases())
      .then(aliases => {
        for (const alias of Object.keys(aliases)) {
          this.indexes[alias] = this.indexes[aliases[alias]];
        }
      });
  }

  _applyDefaultMapping (index, collection) {
    return this.kuzzle.internalEngine.getMapping({ index, type: collection }, true)
      .then(mapping => {
        const collectionMapping = mapping[index].mappings[collection];

        if (collectionMapping.properties._kuzzle_info) {
          Object.assign(
            this.defaultMappings[index]._kuzzle_info.properties,
            collectionMapping.properties._kuzzle_info.properties
          );
        }

        const updatedMapping = {
          [collection]:  {
            dynamic: collectionMapping.dynamic || this.dynamic,
            properties: this.defaultMappings[index]
          }
        };

        return this.kuzzle.internalEngine.updateMapping(collection, updatedMapping, index);
      });
  }

  add (index, collection, notify = true) {
    let modified = false;

    if (index !== undefined) {
      if (!this.indexes[index]) {
        this.indexes[index] = [];
        modified = true;
      }

      if (collection && this.indexes[index].indexOf(collection) === -1) {
        this.indexes[index].push(collection);
        modified = true;
      }
    }

    if (notify && modified) {
      this.kuzzle.pluginsManager.trigger('core:indexCache:add', {index, collection});
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
    let
      modified = false;

    if (index && this.indexes[index]) {
      if (collection) {
        const position = this.indexes[index].indexOf(collection);

        if (position >= 0) {
          this.indexes[index].splice(position, 1);
          modified = true;
        }
      }
      else {
        delete this.indexes[index];
        modified = true;
      }
    }

    if (notify && modified) {
      this.kuzzle.pluginsManager.trigger('core:indexCache:remove', {index, collection});
    }

    return modified;
  }

  reset (index, notify = true) {
    if (index !== undefined) {
      this.indexes[index] = [];
    }
    else {
      this.indexes = {};
    }

    if (notify) {
      this.kuzzle.pluginsManager.trigger('core:indexCache:reset', {index});
    }
  }

  _indexExists (index, hotReload) {
    if (this.indexes[index]) {
      return Bluebird.resolve(true);
    } else if (! hotReload) {
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
    if (this.indexes[index].indexOf(collection) !== -1) {
      return Bluebird.resolve(true);
    } else if (! hotReload) {
      return Bluebird.resolve(false);
    }

    const request = new Request({ index, collection });

    return this.kuzzle.services.list.storageEngine.collectionExists(request)
      .then(collectionExists=> {
        if (! collectionExists) {
          return false;
        }

        return this.kuzzle.internalEngine.updateMapping(collection, {properties: this.commonMapping}, index)
          .then(() => this.add(index, collection, true));
      });
  }
}

module.exports = IndexCache;
