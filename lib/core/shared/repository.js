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

const Bluebird = require('bluebird');
const IndexStorage = require('../storage/indexStorage');
const errorsManager = require('../../util/errors');

const _kuzzle = Symbol.for('_kuzzle');

/**
 * @class Repository
 * @property {Kuzzle} kuzzle
 * @property {string} index
 * @property {number} ttl
 * @property {?string} collection
 * @property {function} ObjectConstructor
 * @property {Redis} cacheEngine
 * @property {IndexStorage} indexStorage
 */
class Repository {
  /**
   * @param {Kuzzle} kuzzle
   * @param {string} index
   * @constructor
   */
  constructor(kuzzle, index = kuzzle.internalIndex.index) {
    this.kuzzle = kuzzle;
    this.index = index;
    this.ttl = kuzzle.config.repositories.common.cacheTTL;
    this.collection = null;
    this.ObjectConstructor = null;
    this.indexStorage = null;
    this.cacheEngine = null;
  }

  /**
   * Initialize the repository
   *
   * @param {object} options
   */
  init (options) {
    // if set to null, it means that we explicitly don't want an indexStorage for this repository
    // as null is falsy, without this check, the indexStorage is always set...
    if (options.indexStorage === null) {
      this.indexStorage = options.indexStorage;
    }
    else {
      // @todo refactor storageEngine set (it's dirty to pass it with options.indexStorage)
      // + its the same index for all repositories (so better to use kuzzle.internalIndex)
      // it only changes for pluginRepository
      this.indexStorage = options.indexStorage
        || new IndexStorage(
          this.index,
          this.kuzzle.storageEngine.internal);
    }

    if (options.cacheEngine === null) {
      this.cacheEngine = options.cacheEngine;
    }
    else {
      this.cacheEngine = options.cacheEngine
        || this.kuzzle.cacheEngine.internal;
    }
  }

  /**
   * @param {string} id
   * @returns {Promise} resolves on a new ObjectConstructor()
   */
  async loadOneFromDatabase (id) {
    let response;

    try {
      response = await this.indexStorage.get(this.collection, id);
    }
    catch (error) {
      if (error.status === 404) {
        throw errorsManager.get('services', 'storage', 'not_found', id);
      }

      throw error;
    }

    if (response._id) {
      const dto = {};

      if (response._source) {
        Object.assign(dto, response._source, {_id: response._id});
      }
      else {
        Object.assign(dto, response);
      }

      return this.fromDTO(dto);
    }

    return null;
  }

  /**
   *
   * @param {string[]|object[]} _ids
   * @returns {Promise<object>}
   */
  loadMultiFromDatabase (ids) {
    return this.indexStorage.mGet(this.collection, ids)
      .then(({ items }) => {
        if (items.length === 0) {
          return [];
        }

        return Bluebird.map(
          items,
          doc => this.fromDTO(Object.assign({}, doc._source, {_id: doc._id}))
        );
      });
  }

  /**
   * Search in database corresponding repository according to a query
   *
   * @param {object} query
   * @param {object} [options] - optional search arguments (from, size, scroll)
   * @returns {Promise}
   */
  search (query, options = {}) {
    return this.indexStorage.search(this.collection, query, options)
      .then(response => this._formatSearchResults(response));
  }

  /**
   * Scroll over a paginated search request
   * @param {string} scrollId
   * @param {string} [ttl]
   */
  scroll (scrollId, ttl) {
    return this.indexStorage.scroll(scrollId, ttl)
      .then(response => this._formatSearchResults(response));
  }

  /**
   * Loads an object from Cache. Returns a promise that resolves either to the
   * retrieved object of null in case it is not found.
   *
   * The opts object currently accepts one optional parameter: key, which forces
   * the cache key to fetch.
   * In case the key is not provided, it defaults to repos/<index>/<collection>/<id>, i.e.: repos/%kuzzle/users/12
   *
   * @param {string} id - The id of the object to get
   * @param {object} [options] - Optional options.
   * @returns {Promise}
   */
  async loadFromCache (id, options = {}) {
    const key = options.key || this.getCacheKey(id);
    let response;

    try {
      response = await this.cacheEngine.get(key);

      if (response === null) {
        return null;
      }

      return await this.fromDTO(Object.assign({}, JSON.parse(response)));
    }
    catch (err) {
      throw errorsManager.get('services', 'cache', 'read_failed', err.message);
    }
  }

  /**
   * Loads an object from Cache or from the Database if not available in Cache.
   * Returns a promise that resolves either to the
   * retrieved object of null in case it is not found.
   *
   * If the object is not found in Cache and found in the Database,
   * it will be written to cache also.
   *
   * The opts object currently accepts one optional parameter: key, which forces
   * the cache key to fetch.
   * In case the key is not provided, it defauls to <collection>/id, i.e.: this.kuzzle/users/12
   *
   * @param {string} id - The id of the object to get
   * @param {object} [options] - Optional options.
   * @returns {Promise}
   */
  load (id, options = {}) {
    if (!this.cacheEngine) {
      return this.loadOneFromDatabase(id);
    }

    return this.loadFromCache(id, options)
      .then(object => {
        if (object === null) {
          if (this.indexStorage === null) {
            return null;
          }

          return this.loadOneFromDatabase(id)
            .then(objectFromDatabase => {
              if (objectFromDatabase !== null) {
                this.persistToCache(objectFromDatabase);
              }

              return objectFromDatabase;
            });
        }
        this.refreshCacheTTL(object);
        return object;
      });
  }

  /**
   * Persists the given object in the collection that is attached to the repository.
   *
   * @param {Profile|Role|User} object - The object to persist
   * @param {object} [options] - The persistence options
   * @returns {Promise}
   */
  persistToDatabase (object, options = {}) {
    const method = options.method || 'createOrReplace';

    return this.indexStorage[method](this.collection, object._id, this.serializeToDatabase(object), options);
  }

  /**
   * Given an object with an id, delete it from the configured storage engines
   *
   * @param {object} object - The object to delete
   * The options optional parameters currently accepts only 1 option:
   *   key: if provided, removes the given key instead of the default one (<collection>/<id>)
   * @param {object} [options] - optional options for the current operation
   * @returns {Promise}
   */
  delete (object, options = {}) {
    const promises = [];

    if (this.cacheEngine) {
      promises.push(this.deleteFromCache(object._id, options));
    }

    if (this.indexStorage) {
      promises.push(this.deleteFromDatabase(object._id, options));
    }

    return Bluebird.all(promises);
  }

  /**
   * Delete repository from database according to its id
   *
   * @param {string} id
   * @param {object} [options]
   */
  deleteFromDatabase (id, options = {}) {
    return this.indexStorage.delete(this.collection, id, options);
  }

  /**
   * Persists the given ObjectConstructor object in cache.
   * The opts optional parameters currently accept 2 options:
   *   key: if provided, stores the object to the given key instead of the default one (<collection>/<id>)
   *   ttl: if provided, overrides the default ttl set on the repository for the current operation.
   *
   * @param {object} object - The object to persist
   * @param {object} [options] - Optional options for the current operation
   * @returns {Promise}
   */
  async persistToCache (object, options = {}) {
    const
      ttl = options.ttl !== undefined ? options.ttl : this.ttl,
      key = options.key || this.getCacheKey(object._id);

    if (ttl === false) {
      await this.cacheEngine.set(
        key,
        JSON.stringify(this.serializeToCache(object)));
    }
    else {
      await this.cacheEngine.setex(
        key,
        ttl,
        JSON.stringify(this.serializeToCache(object)));
    }

    return object;
  }

  /**
   * Removes the object from the Cache Engine
   * The opts optional parameters currently accepts only 1 option:
   *   key: if provided, removes the given key instead of the default one (<collection>/<id>)
   *
   * @param {string} id
   * @param {object} [options] - optional options for the current operation
   * @returns {Promise}
   */
  deleteFromCache (id, options = {}) {
    const key = options.key || this.getCacheKey(id);

    return this.cacheEngine.del(key);
  }

  /**
   * @param {object} object
   * @param {object} [options] - optional options for the current operation
   * @returns {*}
   */
  refreshCacheTTL (object, options = {}) {
    const key = options.key || this.getCacheKey(object._id);
    let ttl;

    if (options.ttl !== undefined) {
      ttl = options.ttl;
    } else if (object.ttl !== undefined) {
      // if a TTL has been defined at the entry creation, we should
      // use it
      ttl = object.ttl;
    } else {
      ttl = this.ttl;
    }

    if (ttl === false) {
      return this.cacheEngine.persist(key);
    }

    return this.cacheEngine.expire(key, ttl);
  }

  /**
   * @param {object} object
   * @param {object} [options] - optional options for the current operation
   * @returns {*}
   */
  expireFromCache (object, options = {}) {
    const key = options.key || this.getCacheKey(object._id);
    return this.cacheEngine.expire(key, -1);
  }

  /**
   * Serializes the object before being persisted to cache.
   *
   * @param {object} object - The object to serialize
   * @returns {object}
   */
  serializeToCache (object) {
    return this.toDTO(object);
  }

  /**
   * Serializes the object before being persisted to the database.
   *
   * @param {object} object - The object to serialize
   * @returns {object}
   */
  serializeToDatabase (object) {
    const dto = this.toDTO(object);
    delete dto._id;
    return dto;
  }

  /**
   * @param {string} id
   */
  getCacheKey (id) {
    return `repos/${this.index}/${this.collection}/${id}`;
  }

  /**
   * @param {object} dto
   * @returns {Promise<ObjectConstructor>}
   */
  async fromDTO (dto) {
    const o = new this.ObjectConstructor();
    o[_kuzzle] = this.kuzzle;
    Object.assign(o, dto);

    return o;
  }

  /**
   * @param {ObjectConstructor} o
   * @returns {object}
   */
  toDTO (o) {
    return Object.assign({}, o);
  }

  /**
   * Recursively delete all objects in repository with a scroll
   *
   * @param {object} options - ES options (refresh)
   * @param {object} part
   * @returns {Promise<integer>} total deleted objects
   */
  async truncate (options, part = null) {
    if (part === null) {
      const objects = await this.search({}, { scroll: '5s', size: 100 });
      const deleted = await this._truncatePart(objects, options);

      if (objects.hits.length < objects.total) {
        const total = await this.truncate(options, {
          fetched: objects.hits.length,
          scrollId: objects.scrollId,
          total: objects.total
        });

        return deleted + total;
      }

      return deleted;
    }

    const objects = await this.scroll(part.scrollId, '5s');
    const deleted = await this._truncatePart(objects, options);

    part.fetched += objects.hits.length;

    if (part.fetched < part.total) {
      part.scrollId = objects.scrollId;

      const total = await this.truncate(options, part);
      return deleted + total;
    }

    return deleted;
  }

  /**
   * @param {Array} objects
   * @param {object} options
   * @returns {Promise<integer>} count of deleted objects
   * @private
   */
  async _truncatePart(objects, options) {
    return Bluebird
      .map(objects.hits, async object => {
        // profile and role repositories have protected objects, we can't delete
        // them
        const protectedObjects = ['profiles', 'roles']
          .indexOf(this.collection) !== -1
          ? ['admin', 'default', 'anonymous']
          : [];

        if (protectedObjects.indexOf(object._id) !== -1) {
          return 0;
        }

        const loaded = await this.load(object._id);
        await this.delete(loaded, options);

        return 1;
      })
      .reduce((total, deleted) => total + deleted, 0);
  }

  /**
   * Given a raw search response from ES, returns a {total: int, hits: []} object
   * @param {object} raw
   * @returns {Promise<object>}
   * @private
   */
  _formatSearchResults (raw) {
    const result = {
      hits: [],
      total: 0
    };

    for (const arg of ['aggregations', 'scrollId']) {
      if (raw[arg]) {
        result[arg] = raw[arg];
      }
    }

    if (raw.hits && raw.hits.length > 0) {
      result.total = raw.total;

      return Bluebird
        .map(raw.hits, doc => this.fromDTO(
          Object.assign({}, doc._source, { _id: doc._id })))
        .then(hits => {
          result.hits = hits;
          return result;
        });
    }

    return Bluebird.resolve(result);
  }
}

module.exports = Repository;
