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
  Elasticsearch = require('../../../services/elasticsearch'),
  errorsManager = require('../../../util/errors').wrap('services', 'storage'),
  ClientAdapter = require('./clientAdapter'),
  Bluebird = require('bluebird');

class StorageEngine {
  constructor(kuzzle) {
    this._kuzzle = kuzzle;

    // RAM cache structure:
    //   myIndex: {
    //     scope: 'public',
    //     collections: []
    //   }
    this._indexes = {};

    // Syntaxic sugar: IndexCache methods
    this._indexCache = {
      add: (...args) => this._add(...args),
      remove: (...args) => this._remove(...args),
      exists: (...args) => this._exists(...args)
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

    if (! index || ! collection) {
      return modified;
    }

    if (! this._indexes[index]) {
      this._indexes[index] = {
        scope,
        collections: []
      };
    }

    if (! this._indexes[index].collections.includes(collection)) {
      this._indexes[index].collections.push(collection);

      modified = true;
    }

    if (notify && modified) {
      this._kuzzle.emit('core:indexCache:add', { index, collection, scope });
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
      && this._indexes[index].collections.includes(collection);
  }

  /**
   * Removes an index or a collection from the cache
   *
   * @param {Object} arguments - index, collection, scope (public), notify (true)
   *
   * @returns {boolean}
   */
  _remove ({ index, collection, scope='public', notify=true }) {
    let modified = false;

    if ( this._indexes[index] && this._indexes[index].scope === scope) {
      if (collection) {
        const position = this._indexes[index].collections.indexOf(collection);

        if (position !== -1) {
          this._indexes[index].collections.splice(position, 1);

          if (this._indexes[index].collections.length === 0) {
            delete this._indexes[index];
          }

          modified = true;
        }
      } else {
        delete this._indexes[index];
        modified = true;
      }
    }

    if (notify && modified) {
      this._kuzzle.emit('core:indexCache:remove', { index, collection, scope });
    }

    return modified;
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
      this._internalClient.listIndexes()
        .then(indexes => {
          internalIndexes = indexes;

          return this._addCollections(indexes, 'internal');
        }));

    promises.push(
      this._publicClient.listIndexes()
        .then(indexes => {
          publicIndexes = indexes;

          return this._addCollections(indexes, 'public');
        }));

    await Bluebird.all(promises);

    for (const publicIndex of publicIndexes) {
      if (internalIndexes.includes(publicIndex)) {
        errorsManager.throw('index_already_exists', 'public', publicIndex);
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
    return Boolean(this._indexes[index]) && this._indexes[index].scope === scope;
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
      storageClient = scope === 'public'
        ? this._publicClient
        : this._internalClient,
      promises = [];

    for (const index of indexes) {
      this._indexes[index] = {
        scope,
        collections: []
      };

      promises.push(
        storageClient.listCollections(index)
          .then(collections => {
            for (const collection of collections) {
              this._indexes[index].collections.push(collection);
            }
          }));
    }

    return Bluebird.all(promises);
  }

  async _addCollectionsAliases () {
    const aliases = await this._publicClient.listAliases();

    for (const { name, index } of aliases) {
      this._indexes[index].collections.push(name);
    }
  }
}

module.exports = StorageEngine;
