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
  Bluebird = require('bluebird');

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

    this._rawMethods = [
      'get',
      'mGet',
      'search',
      'count',
      'exists',
      'createOrReplace',
      'replace',
      'update',
      'delete',
      'createCollection',
      'refreshCollection',
      'deleteIndex',
      'getMapping',
      'updateMapping'
    ];

    this._otherMethods = [
      'scroll',
      'create',
      'createOrReplace',
      'replace',
      'update',
      'delete'
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
   * Initialize the index with the provided boostrap
   *
   * @return {Promise}
   */
  async init () {
    const exists = await this._storageEngine.indexExists(this._index);

    if (! exists) {
      await this._storageEngine.createIndex(this._index);
    }

    if (! this._bootstrap) {
      return Bluebird.resolve();
    }

    return this._bootstrap.startOrWait();
  }

  scroll (collection, scrollId, scrollTTL) {
    return this._storageEngine.scroll(
      this._index,
      collection,
      scrollId,
      { scroll: scrollTTL });
  }

  create (collection, id, content, options = {}) {
    const opts = {
      id,
      refresh: options.refresh
    };

    return this._storageEngine.create(this._index, collection, content, opts);
  }
}

module.exports = IndexStorage;
