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
 * Wrapper around a storage engine.
 * Once instantiated, this class can only access the index passed in the
 * constructor
 */
class IndexStorage {
  /**
   *
   * @param {String} index
   * @param {StorageEngine} storageEngine
   */
  constructor (index, storageEngine) {
    this._index = index;
    this._storageEngine = storageEngine;

    this._bootstrap = null;

    // methods bound to the storage engine
    this._rawMethods = [
      'batchExecute',
      'count',
      'createCollection',
      'createOrReplace',
      'delete',
      'deleteByQuery',
      'deleteCollection',
      'deleteIndex',
      'exists',
      'get',
      'getMapping',
      'mGet',
      'refreshCollection',
      'replace',
      'search',
      'truncateCollection',
      'update',
      'updateByQuery',
      'updateCollection',
      'updateMapping'
    ];

    // we need to declare these method to keep backward compat with Repository API
    this._otherMethods = [
      'create',
      'scroll'
    ];

    for (const method of this._rawMethods) {
      this[method] = (...args) => this._storageEngine[method](this._index, ...args);
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
      indexBootstrap instanceof require('./bootstrap/safeBootstrap'),
      'IndexStorage bootstrap must be an instance of SafeBootstrap');

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
   * Scrolls a previously executed search
   *
   * @param {String} scrollId - Scroll identifier
   * @param {String} scrollTTL - New scroll TTL
   */
  scroll (scrollId, scrollTTL) {
    return this._storageEngine.scroll(scrollId, { scrollTTL });
  }

  /**
   * Creates a document
   *
   * @param {String} collection - Collection name
   * @param {String} id - Document ID, may be null
   * @param {Object} content - Document content
   * @param {Object} options
   */
  create (collection, id, content, options = {}) {
    const opts = {
      id,
      refresh: options.refresh
    };

    return this._storageEngine.create(this._index, collection, content, opts);
  }

  /**
   * Creates collections with the provided mappings
   *
   * @param {Object} collections - collections with mappings
   *
   * @returns {Promise}
   */
  createCollections (collections) {
    const promises = [];

    for (const [collection, mappings] of Object.entries(collections)) {
      promises.push(
        this._storageEngine.createCollection(this._index, collection, { mappings }));
    }

    return Bluebird.all(promises);
  }
}

module.exports = IndexStorage;
