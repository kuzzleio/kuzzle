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

const errorsManager = require('../../util/errors').wrap('services', 'storage');

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
    this._client = storageClient;
    this._indexCache = indexCache;

    // Methods that needs to assert index and collection existence
    this._assertIndexAndCollectionMethods = [
      'batchExecute',
      'count',
      'create',
      'createOrReplace',
      'delete',
      'deleteByQuery',
      'exists',
      'get',
      'getMapping',
      'import',
      'mCreate',
      'mCreateOrReplace',
      'mDelete',
      'mGet',
      'mReplace',
      'mUpdate',
      'refreshCollection',
      'replace',
      'search',
      'truncateCollection',
      'update',
      'updateByQuery',
      'updateCollection',
      'updateMapping'
    ];

    // Methods directly bound to the storageClient
    this._rawMethods = [
      'info',
      'init',
      'isCollectionNameValid',
      'isIndexNameValid',
      'listAliases',
      'scroll'
    ];

    // Methods that need to assert index/collection existence and add/remove
    // item from the indexCache
    this._cacheChangeMethods = [
      'createIndex',
      'createCollection',
      'deleteIndexes',
      'deleteIndex',
      'deleteCollection'
    ];

    // Methods that can use directly the index cache content
    this._canUseIndexCache = [
      'collectionExists',
      'indexExists',
      'listCollections',
      'listIndexes'
    ]

    for (const method of this._assertIndexAndCollectionMethods) {
      this[method] = (index, collection, ...args) => {
        this._assertIndexAndCollectionExists(index, collection);

        return this._client[method](index, collection, ...args);
      };
    }
    for (const method of this._rawMethods) {
      this[method] = (...args) => this._client[method](...args);
    }
  }

  async createIndex (index) {
    const response = await this._client.createIndex(index);

    this._indexCache.add({ index, scope: this._client.scope });

    return response;
  }

  async createCollection (index, collection, config) {
    const response = await this._client.createCollection(index, collection, config);

    this._indexCache.add({ collection, index, scope: this._client.scope });

    return response;
  }

  async deleteIndex (index) {
    this._assertIndexExists(index);

    const response = await this._client.deleteIndex(index);

    this._indexCache.remove({ index, scope: this._client.scope });

    return response;
  }

  async deleteIndexes (indexes) {
    for (const index of indexes) {
      this._assertIndexExists(index);
    }

    const response = await this._client.deleteIndexes(indexes);

    for (const index of indexes) {
      this._indexCache.remove({ index, scope: this._client.scope });
    }

    return response;
  }

  async deleteCollection (index, collection) {
    this._assertIndexAndCollectionExists(index, collection);

    const response = await this._client.deleteCollection(index, collection);

    this._indexCache.remove({ collection, index, scope: this._client.scope });

    return response;
  }

  async indexExists (index, { fromCache = true } = {}) {
    if (fromCache) {
      return this._indexCache.exists({ index, scope: this._client.scope });
    }

    return this._client.indexExists(index);
  }

  async collectionExists (index, collection, { fromCache = true } = {}) {
    this._assertIndexExists(index);

    if (fromCache) {
      return this._indexCache.exists({ index, collection, scope: this._client.scope });
    }

    return this._client.collectionExists(index, collection);
  }

  async listIndexes ({ fromCache = true } = {}) {
    if (fromCache) {
      return this._indexCache.listIndexes({ scope: this._client.scope });
    }

    return this._client.listIndexes();
  }

  async listCollections (index, { fromCache = true } = {}) {
    this._assertIndexExists(index);

    if (fromCache) {
      return this._indexCache.listCollections({ index, scope: this._client.scope });
    }

    return this._client.listCollections(index);
  }

  _assertIndexAndCollectionExists (index, collection) {
    this._assertIndexExists(index);

    const exists = this._indexCache.exists({
      collection,
      index,
      scope: this._client.scope
    });

    if (! exists) {
      throw errorsManager.get('unknown_collection', collection);
    }
  }

  _assertIndexExists (index) {
    const exists = this._indexCache.exists({
      index,
      scope: this._client.scope
    });

    if (! exists) {
      throw errorsManager.get('unknown_index', index);
    }
  }
}

module.exports = ClientAdapter;
