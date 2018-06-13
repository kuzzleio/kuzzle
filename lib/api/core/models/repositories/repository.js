/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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
  KuzzleInternalError = require('kuzzle-common-objects').errors.InternalError;

const _kuzzle = Symbol.for('_kuzzle');

/**
 * @class Repository
 * @property {Kuzzle} kuzzle
 * @property {string} index
 * @property {number} ttl
 * @property {?string} collection
 * @property {function} ObjectConstructor
 * @property {Redis} cacheEngine
 * @property {InternalEngine} databaseEngine
 */
class Repository {
  /**
   * @param {Kuzzle} kuzzle
   * @param {string} index
   * @constructor
   */
  constructor(kuzzle, index = kuzzle.internalEngine.index) {
    this.kuzzle = kuzzle;
    this.index = index;
    this.ttl = kuzzle.config.repositories.common.cacheTTL;
    this.collection = null;
    this.ObjectConstructor = null;
    this.databaseEngine = null;
    this.cacheEngine = null;
  }

  /**
   * Initialize the repository
   *
   * @param {object} options
   */
  init (options) {
    // if set to null, it means that we explicitely dont want a databaseEngine for this repository
    // as null is falsy, without this check, the databaseEngine is always set...
    if (options.databaseEngine === null) {
      this.databaseEngine = options.databaseEngine;
    }
    else {
      this.databaseEngine = options.databaseEngine || this.kuzzle.internalEngine;
    }
    if (options.cacheEngine === null) {
      this.cacheEngine = options.cacheEngine;
    }
    else {
      this.cacheEngine = options.cacheEngine || this.kuzzle.services.list.internalCache;
    }
  }

  /**
   * @param {string} id
   * @returns {Promise} resolves on a new ObjectConstructor()
   */
  loadOneFromDatabase (id) {
    return this.databaseEngine.get(this.collection, id)
      .then(response => {
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
      })
      .catch(error => {
        if (error.status === 404) {
          // no content found, we return null without failing
          return Bluebird.resolve(null);
        }

        return Bluebird.reject(error);
      });
  }

  /**
   *
   * @param {string[]|object[]} _ids
   * @returns {Promise<object>}
   */
  loadMultiFromDatabase (ids) {
    if (!Array.isArray(ids)) {
      return Bluebird.reject(new KuzzleInternalError(`Bad argument: ${ids.toString()} is not an array.`));
    }

    return this.databaseEngine.mget(this.collection, ids)
      .then(response => {
        if (!response.hits || response.hits.length === 0) {
          return [];
        }

        return Bluebird.map(
          response.hits.filter(doc => doc.found),
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
    return this.databaseEngine.search(this.collection, query, options)
      .then(response => this._formatSearchResults(response));
  }

  /**
   * Scroll over a paginated search request
   * @param {string} scrollId
   * @param {string} [ttl]
   */
  scroll (scrollId, ttl) {
    return this.databaseEngine.scroll(this.collection, scrollId, ttl)
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
  loadFromCache (id, options = {}) {
    const key = options.key || this.getCacheKey(id);

    return this.cacheEngine.get(key)
      .then(response => {
        if (response === null) {
          return null;
        }

        return this.fromDTO(Object.assign({}, JSON.parse(response)));
      })
      .catch(err => Bluebird.reject(new KuzzleInternalError(err)));
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
          if (this.databaseEngine === null) {
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

    return this.databaseEngine[method](this.collection, object._id, this.serializeToDatabase(object), options);
  }

  /**
   * Given an object id, delete it from the configured storage engines
   *
   * @param {string} id - The id of the object to delete
   * The options optional parameters currently accepts only 1 option:
   *   key: if provided, removes the given key instead of the default one (<collection>/<id>)
   * @param {object} [options] - optional options for the current operation
   * @returns {Promise}
   */
  delete (id, options = {}) {
    const promises = [];

    if (this.cacheEngine) {
      promises.push(this.deleteFromCache(id, options));
    }

    if (this.databaseEngine) {
      promises.push(this.deleteFromDatabase(id, options));
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
    return this.databaseEngine.delete(this.collection, id, options);
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
  persistToCache (object, options = {}) {
    const
      ttl = options.ttl !== undefined ? options.ttl : this.ttl,
      key = options.key || this.getCacheKey(object._id);

    if (ttl === false) {
      return this.cacheEngine.set(key, JSON.stringify(this.serializeToCache(object)))
        .then(() => object);
    }

    return this.cacheEngine.setex(key, ttl, JSON.stringify(this.serializeToCache(object)))
      .then(() => object);
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
  fromDTO (dto) {
    const o = new this.ObjectConstructor();
    o[_kuzzle] = this.kuzzle;
    Object.assign(o, dto);

    return Bluebird.resolve(o);
  }

  /**
   * @param {ObjectConstructor} o
   * @returns {object}
   */
  toDTO (o) {
    return Object.assign({}, o);
  }

  /**
   * Given a raw search response from ES, returns a {total: int, hits: []} object
   * @param {object} raw
   * @returns {Promise<object>}
   * @private
   */
  _formatSearchResults (raw) {
    const result = {
      total: 0,
      hits: []
    };

    if (raw.scrollId) {
      result.scrollId = raw.scrollId;
    }

    if (raw.hits && raw.hits.length > 0) {
      result.total = raw.total;
      return Bluebird.map(raw.hits, doc => this.fromDTO(Object.assign({}, doc._source, {_id: doc._id})))
        .then(hits => {
          result.hits = hits;
          return result;
        });
    }

    return Bluebird.resolve(result);
  }

}

module.exports = Repository;
