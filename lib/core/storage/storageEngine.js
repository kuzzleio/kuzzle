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

const Elasticsearch = require('../../service/storage/elasticsearch');
const kerror = require('../../kerror').wrap('services', 'storage');
const ClientAdapter = require('./clientAdapter');
const BaseModel = require('../../model/storage/baseModel');
const Bluebird = require('bluebird');

class IndexCache {
  constructor (scope) {
    this.scope = scope;
    this.collections = new Set();
  }
}

class StorageEngine {
  constructor(kuzzle) {
    this._kuzzle = kuzzle;

    // RAM cache structure:
    //   Map.<index, IndexCaches>
    this._indexes = new Map();

    // Syntaxic sugar: IndexCache methods
    this._indexCache = {
      add: (...args) => this._add(...args),
      exists: (...args) => this._exists(...args),
      listCollections: (...args) => this._listCollections(...args),
      listIndexes: (...args) => this._listIndexes(...args),
      remove: (...args) => this._remove(...args)
    };

    // Storage client for public indexes only
    this._publicClient = new ClientAdapter(
      new Elasticsearch(this._kuzzle, this.config, 'public'),
      this.indexCache);

    // Storage client for internal indexes only
    this._internalClient = new ClientAdapter(
      new Elasticsearch(this._kuzzle, this.config, 'internal'),
      this.indexCache);
  }

  get indexCache () {
    return this._indexCache;
  }

  get public () {
    return this._publicClient;
  }

  get internal () {
    return this._internalClient;
  }

  get config () {
    return this._kuzzle.config.services.storageEngine;
  }

  /**
   * Initialize storage clients and populate index cache
   *
   * @returns {Promise}
   */
  async init () {
    const promises = [];

    promises.push(this._publicClient.init());
    promises.push(this._internalClient.init());

    await Bluebird.all(promises);

    await this._populateIndexCache();

    BaseModel.init(this._kuzzle);
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
  _add ({ index, collection, scope='public', notify=true } = {}) {
    let modified = false;

    if (index) {
      let indexCache = this._indexes.get(index);
      if (!indexCache) {
        indexCache = new IndexCache(scope);
        this._indexes.set(index, indexCache);
        modified = true;
      }

      if (collection && !indexCache.collections.has(collection)) {
        indexCache.collections.add(collection);
        modified = true;
      }
    }

    if (notify && modified) {
      this._kuzzle.emit('core:indexCache:add', { collection, index, scope });
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
  _exists ({ index, collection, scope='public' } = {}) {
    if (! collection) {
      return this._indexExists(index, scope);
    }

    return this._indexExists(index, scope)
      && this._indexes.get(index).collections.has(collection);
  }

  /**
   * Removes an index or a collection from the cache
   *
   * @param {Object} arguments - index, collection, scope (public), notify (true)
   *
   * @returns {boolean}
   */
  _remove ({ index, collection, scope='public', notify=true } = {}) {
    let modified = false;
    const indexCache = this._indexes.get(index);

    if (index && indexCache) {
      if (collection) {
        modified = indexCache.collections.delete(collection);
      }
      else {
        modified = this._indexes.delete(index);
      }
    }

    if (notify && modified) {
      this._kuzzle.emit('core:indexCache:remove', { collection, index, scope });
    }

    return modified;
  }

  /**
   * Lists the indexes contained in the index cache
   *
   * @param {Object} arguments - scope (public)
   *
   * @returns {String[]}
   */
  _listIndexes ({ scope='public' } = {}) {
    const indexes = [];

    for (const [name, content] of this._indexes.entries()) {
      if (content.scope === scope) {
        indexes.push(name);
      }
    }

    return indexes;
  }

  /**
   * Lists collections contained in an index
   *
   * @param {Object} arguments - index, scope (public)
   */
  _listCollections ({ index, scope='public'} = {}) {
    if (! this._exists({ index, scope })) {
      throw kerror.get('unknown_index', index);
    }

    return Array.from(this._indexes.get(index).collections);
  }

  /**
   * Populates the index cache with existing index/collection and aliases.
   * Also checks for duplicated index names.
   *
   * @returns {Promise}
   */
  async _populateIndexCache () {
    let
      publicIndexes,
      internalIndexes;

    const promises = [];

    promises.push(
      this._internalClient.listIndexes({ fromCache: false })
        .then(indexes => {
          internalIndexes = indexes;

          return this._addCollections(indexes, 'internal');
        }));

    promises.push(
      this._publicClient.listIndexes({ fromCache: false })
        .then(indexes => {
          publicIndexes = indexes;

          return this._addCollections(indexes, 'public');
        }));

    await Bluebird.all(promises);

    for (const publicIndex of publicIndexes) {
      if (internalIndexes.includes(publicIndex)) {
        throw kerror.get('index_already_exists', 'public', publicIndex);
      }
    }

    await this._addCollectionsAliases();
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
    const indexCache = this._indexes.get(index);
    return indexCache !== undefined && indexCache.scope === scope;
  }

  /**
   * Lists collections from all indexes passed in argument and adds them to the
   * cache
   *
   * @param {Array.<String>} indexes - Index names
   * @param {String} scope - Index type (public or internal)
   *
   * @returns {Promise}
   */
  _addCollections (indexes, scope) {
    const
      storageClient = scope === 'public'
        ? this._publicClient
        : this._internalClient,
      promises = [];

    for (const index of indexes) {
      this._indexes.set(index, new IndexCache(scope));

      promises.push(
        storageClient.listCollections(index, { fromCache: false })
          .then(collections => {
            for (const collection of collections) {
              this._indexes.get(index).collections.add(collection);
            }
          }));
    }

    return Bluebird.all(promises);
  }

  async _addCollectionsAliases () {
    const aliases = await this._publicClient.listAliases();

    for (const { name, index } of aliases) {
      this._indexes.get(index).collections.add(name);
    }
  }
}

module.exports = StorageEngine;
