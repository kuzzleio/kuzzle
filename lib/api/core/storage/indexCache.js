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
  assert = require('assert'),
  errorsManager = require('../../../config/error-codes/throw'),
  Bluebird = require('bluebird');

/**
 * @deprecated
 * Index/collection cache management
 */
class IndexCache {

  constructor (kuzzle) {
    this.kuzzle = kuzzle;

    this.internalStorage = this.kuzzle.services.internalStorage;
    this.publicStorage = this.kuzzle.services.publicStorage;

    // RAM cache structure:
    //   myIndex: {
    //     scope: 'public',
    //     collections: []
    //   }
    this.indexes = {};
  }

  /**
   * Initializes the index cache with existing indexes and collections
   *
   * @returns {Promise}
   */
  async init () {
    let
      publicIndexes = [],
      internalIndexes = [];

    const promises = [];

    promises.push(
      this.internalStorage.listIndexes()
        .then(indexes => {
          publicIndexes = indexes;

          return this._addCollections(indexes, 'internal');
        }));

    promises.push(
      this.publicStorage.listIndexes()
      .then(indexes => {
        internalIndexes = indexes;

        return this._addCollections(indexes, 'public');
      }));

    await Bluebird.all(promises);

    for (const index of publicIndexes) {
        assert(
          ! internalIndexes.includes(index),
          `Found duplicated index in public and internal scopes: ${index}`);
    }

    await this._addCollectionsAliases();
  }

  /**
   * Adds an index and/or a collection to the cache.
   * An event is emitted for other cluster node synchronization if the cache
   * has changed.
   *
   * @param {Object} arguments - index, collection, scope (public), notify (true)
   *
   * @returns {boolean} True if the cache has changed
   */
  add ({ index, collection, scope='public', notify=true } = {}) {
    let modified = false;

    if (index && ! this.indexes[index]) {
      this.indexes[index] = {
        scope,
        collections: []
      };

      modified = true;
    }

    if (collection && ! this.indexes[index].collections.includes(collection)) {
      this.indexes[index].collections.push(collection);

      modified = true;
    }

    if (notify && modified) {
      this.kuzzle.emit('core:indexCache:add', { index, collection, scope });
    }

    return modified;
  }
  /**
   * Tests if an index or a collection exists in cache.
   *
   * @param {Object} arguments - index, collection, scope (public)
   *
   * @returns {boolean}
   */
  exists ({ index, collection, scope='public' } = {}) {
    if (! collection) {
      return this._indexExists(index, scope);
    }

    return this._indexExists(index, scope)
      && this.indexes[index].collections.includes(collection);
  }

  /**
   * Removes an index or a collection from the cache
   *
   * @param {Object} arguments - index, collection, scope (public), notify (true)
   *
   * @returns {boolean}
   */
  remove ({ index, collection, scope='public', notify=true }) {
    let modified = false;

    if (this.indexes[index] && this.indexes[index].scope === scope) {
      if (collection) {
        const position = this.indexes[index].collections.indexOf(collection);

        if (position >= 0) {
          this.indexes[index].collections.splice(position, 1);
          modified = true;
        }
      }
      else {
        delete this.indexes[index];
        modified = true;
      }
    }

    if (notify && modified) {
      this.kuzzle.emit('core:indexCache:remove', { index, collection, scope });
    }

    return modified;
  }

  /**
   * Returns true if the index exists in cache
   *
   * @param {String} index - Index name
   * @param {String} scope - Index type (public or internal)
   *
   * @returns {boolean}
   */
  _indexExists (index, scope = 'public') {
    return Boolean(this.indexes[index]) && this.indexes[index].scope === scope;
  }

  /**
   * Lists collections from all indexes passed in argument and adds them to the cache
   *
   * @param {Array.<String>} indexes - Index names
   * @param {String} scope - Index type (public or internal)
   *
   * @returns {Promise}
   */
  _addCollections (indexes, scope) {
    const
      storageEngine = scope === 'public'
        ? this.publicStorage
        : this.internalStorage,
      promises = [];

    for (const index of indexes) {
      this.indexes[index] = {
        scope,
        collections: []
      };

      promises.push(
        storageEngine.listCollections(index)
          .then(collections => {
            for (const collection of collections) {
              this.indexes[index].collections.push(collection);
            }
          }));
    }

    return Bluebird.all(promises);
  }

  async _addCollectionsAliases () {
    const aliases = await this.publicStorage.listAliases();

    for (const { name, index, collection } of aliases) {
      if (! this.exists({ index, collection, scope: 'public' })) {
        errorsManager.throw(
          'internal',
          'index_cache',
          'unknown_collection_alias',
          name,
          `${index}/${collection}`);
      }

      this.indexes[index].collections.push(name);
    }
  }
}

module.exports = IndexCache;
