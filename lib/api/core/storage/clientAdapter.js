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

/**
 * Storage client adapter to perform validation on index/collection existence
 * and to maintain the index/collection cache.
 */
class ClientAdapter {
  /**
   * @param {Elasticsearch} storageClient
   * @param {IndexCache} indexCache
   */
  constructor (storageClient, indexCache) {
    this._storageClient = storageClient;
    this._indexCache = indexCache;

    // Methods that needs to assert index and collection existence
    this.assertIndexAndCollectionMethods = [
      'scroll',
      'search',
      'get',
      'mGet',
      'count',
      'create',
      'createOrReplace',
      'update',
      'replace',
      'delete',
      'deleteByQuery',
      'getMapping',
      'updateMapping',
      'truncateCollection',
      'import',
      'refreshCollection',
      'exists',
      'mCreate',
      'mCreateOrReplace',
      'mUpdate',
      'mReplace',
      'mDelete'
    ];

    // Methods that needs to assert index existence
    this.assertIndexMethods = [
      'listCollections',
      'collectionExists'
    ];

    // Methods directly bind to the storageClient
    this.rawMethods = [
      'listIndexes',
      'listAliases',
      'info',
      'indexExists',
      'init'
    ];

    // Methods that need to assert index/collection existence and add/remove item
    // from the indexCache
    this.othersMethods = [
      'createIndex',
      'createCollection',
      'deleteIndexes',
      'deleteIndex'
    ];

    for (const method of this.assertIndexAndCollectionMethods) {
      this[method] = (index, collection, ...args) => {
        this._assertIndexAndCollection(index, collection);

        return this._storageClient[method](index, collection, ...args);
      }
    }

    for (const method of this.assertIndexMethods) {
      this[method] = (index, ...args) => {
        this._assertIndex(index);

        return this._storageClient[method](index, ...args);
      }
    }

    for (const method of this.rawMethods) {
      this[method] = (...args) => this._storageClient[method](...args);
    }
  }

  async createIndex (index) {
    const response = await this._storageClient.createIndex(index);

    this._indexCache.add({ index, scope: this._storageClient.scope });

    return response;
  }

  async createCollection (index, collection) {
    this._assertIndex(index);

    const response = await this._storageClient.createCollection(index, collection);

    this._indexCache.add({ index, collection, scope: this._storageClient.scope });

    return response;
  }

  async deleteIndex (index) {
    this._assertIndex(index);

    const response = await this._storageClient.deleteIndex(index);

    this._indexCache.remove({ index, scope: this._storageClient.scope });

    return response;
  }

  async deleteIndexes (indexes) {
    for (const index of indexes) {
      this._assertIndex(index);
    }

    const response = await this._storageClient.deleteIndexes(indexes);

    for (const index of indexes) {
      this._indexCache.remove({ index, scope: this._storageClient.scope });
    }

    return response;
  }
}

module.exports = ClientAdapter;