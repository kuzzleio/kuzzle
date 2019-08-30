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
  { Request } = require('kuzzle-common-objects'),
  errorsManager = require('../../config/error-codes/throw'),
  _ = require('lodash');

/**
 * @deprecated
 * Index/collection cache management
 */
class IndexCache {

  constructor (kuzzle) {
    this.kuzzle = kuzzle;

    this.internalStorage = this.kuzzle.services.internalStorage;
    this.publicStorage = this.kuzzle.services.publicStorage;

    // Structure:
    //   myIndex: {
    //     indexType: 'public',
    //     collections: []
    //   }
    this.indexes = {};
  }

  /**
   * Initializes the index cache with existing indexes and collections
   *
   * @returns {Promise}
   */
  init () {
    const promises = [];

    promises.push(
      this.internalStorage.listIndexes()
        .then(indexes => this._addCollections(indexes, 'internal')));

    promises.push(
      this.publicStorage.listIndexes()
        .then(indexes => this._addCollections(indexes, 'public')));

    return Bluebird.all(promises);
  }

  /**
   * Lists collections from all indexes passed in argument and add them to the cache
   *
   * @param {Array.<String>} indexes - Index names
   * @param {String} indexType - Index type (internal or public)
   *
   * @returns {Promise}
   */
  _addCollections (indexes, indexType) {
    const promises = [];

    for (const index of indexes) {
      this.indexes[index] = {
        indexType,
        collections: []
      };

      promises.push(
        this.internalStorage.listCollections(index)
          .then(collections => {
            for (const collection in collections) {
              this.indexes[index].collections.push(collection)
            }
          }));
    }

    return Bluebird.all(promises);
  }

  /**
   * Adds an index and/or a collection to the cache.
   * An event is emitted for other cluster node synchronization if the cache
   * has changed.
   *
   * @param {Object} arguments - index, collection, indexType (public)
   *
   * @returns {boolean} True if the cache has changed
   */
  add ({ index, collection=null, indexType='public' } = {}) {
    let modified = false;

    if (! this.indexes[index]) {
      this.indexes[index] = {
        indexType,
        collections: []
      };

      modified = true;
    }

    if (collection && this.indexes[index].collections.includes(collection)) {
      this.indexes[index].collections.push(collection);

      modified = true;
    }

    if (modified) {
      // @todo modify cluster for indexType
      this.kuzzle.emit('core:indexCache:add', { index, collection, indexType });
    }

    return modified;
  }
  /**
   * Tests if an index or a collection exists in cache.
   *
   * @param {Object} arguments - index, collection, indexType (public)
   *
   * @returns {boolean}
   */
  exists ({ index, collection=null, indexType='public' } = {}) {
    if (! collection) {
      return this._indexExists(index, indexType);
    }

    return this.indexExists(index, indexType)
      && this.indexes[index].collections.includes(collection);
  }

  _indexExists (index, indexType = 'public') {
    return this.indexes[index] && this.indexes[index].indexType === indexType;
  }

  /**
   * Removes an index or a collection from the cache
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   *
   * @returns {boolean}
   */
  remove (index, collection) {
    let modified = false;

    if (this.indexes[index]) {
      if (collection) {
        const position = this.indexes[index].collections.indexOf(collection);

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

    if (modified) {
      this.kuzzle.emit('core:indexCache:remove', { index, collection });
    }

    return modified;
  }
}

module.exports = IndexCache;
