var
  _ = require('lodash'),
  Promise = require('bluebird'),
  InternalError = require('kuzzle-common-objects').errors.InternalError;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function Repository (kuzzle) {
  this.kuzzle = kuzzle;
  this.index = kuzzle.internalEngine.index;
  this.ttl = kuzzle.config.repositories.common.cacheTTL;
  this.collection = null;
  this.ObjectConstructor = null;
  this.databaseEngine = null;
  /** @type {Redis} */
  this.cacheEngine = null;
  this.cacheKeyPrefix = 'repos/';
}

/**
 * Initialize the repository
 *
 * @param options
 */
Repository.prototype.init = function repositoryInit (options) {
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
  this.cacheKeyPrefix = 'repos/' + this.index + '/' + this.collection + '/';
};

/**
 *
 * @param {string} id
 * @returns {Promise} resolves on a new ObjectConstructor()
 */
Repository.prototype.loadOneFromDatabase = function repositoryLoadOneFromDatabase (id) {
  var result;

  return this.databaseEngine.get(this.collection, id)
    .then(response => {
      if (response._id) {
        result = new this.ObjectConstructor();
        if (response._source) {
          return _.assignIn(result, response._source, {_id: response._id});
        }
        return _.assignIn(result, response);
      }
      return null;
    })
    .catch(error => {
      if (error.status === 404) {
        // no content found, we return null without failing
        return Promise.resolve(null);
      }

      return Promise.reject(error);
    });
};

/**
 *
 * @param _ids
 * @returns {*|promise}
 */
Repository.prototype.loadMultiFromDatabase = function repositoryLoadMultiFromDatabase (_ids) {
  var ids = [];

  if (!_.isArray(_ids)) {
    return Promise.reject(new InternalError('Bad argument: ' + _ids.toString() + ' is not an array.'));
  }
  _ids.forEach(element => {
    if (!_.isObject(element)) {
      ids.push(element);
    }
    else {
      ids.push(element._id);
    }
  });

  return this.databaseEngine.mget(this.collection, ids)
    .then(response => {
      if (!response.hits || response.hits.length === 0) {
        return Promise.resolve([]);
      }

      return response.hits
        .filter(document => document.found)
        .map(document => {
          var object = new this.ObjectConstructor();

          return _.assignIn(object, document._source, {_id: document._id});
        });
    });
};

/**
 * Search in database corresponding repository according to a query
 *
 * @param {object} query
 * @param {number} from manage pagination
 * @param {number} size manage pagination
 *
 * @returns {Promise}
 */
Repository.prototype.search = function repositorySearch (query, from, size) {
  return this.databaseEngine.search(this.collection, query, from, size)
    .then(response => {
      if (!response.hits || response.hits.length === 0) {
        return {total: 0, hits: []};
      }

      return {
        total: response.total,
        hits: response.hits.map((document) => {
          return _.assignIn({}, document._source, {_id: document._id});
        })
      };
    });
};

/**
 * Loads an object from Cache. Returns a promise that resolves either to the
 * retrieved object of null in case it is not found.
 *
 * The opts object currently accepts one optional parameter: key, which forces
 * the cache key to fetch.
 * In case the key is not provided, it defauls to <collection>/id, i.e.: _kuzzle/users/12
 *
 * @param {string} id The id of the object to get
 * @param {object} opts Optional options.
 * @returns {Promise}
 */
Repository.prototype.loadFromCache = function repositoryLoadFromCache (id, opts) {
  var
    options = opts || {},
    key = options.key || this.cacheKeyPrefix + id;

  return this.cacheEngine.get(key)
    .then(response => {
      var object;

      if (response === null) {
        return null;
      }

      object = new this.ObjectConstructor();

      return _.assignIn(object, JSON.parse(response));
    })
    .catch(err => Promise.reject(new InternalError(err)));
};

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
 * In case the key is not provided, it defauls to <collection>/id, i.e.: _kuzzle/users/12
 *
 * @param {string} id The id of the object to get
 * @param {object} [opts] Optional options.
 * @returns {Promise}
 */
Repository.prototype.load = function repositoryLoad (id, opts) {
  if (!this.cacheEngine) {
    return this.loadOneFromDatabase(id);
  }

  return this.loadFromCache(id, opts)
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
};

/**
 * Persists the given object in the collection that is attached to the repository.
 *
 * @param {Profile|Role|User} object The object to persist
 * @param {object} opts The persistence options
 * @returns {Promise}
 */
Repository.prototype.persistToDatabase = function repositoryPersistToDatabase (object, opts) {
  var
    options = opts || {},
    method = options.method || 'createOrReplace';

  return this.databaseEngine[method](this.collection, object._id, this.serializeToDatabase(object));
};

/**
 * Given an object id, delete it from the configured storage engines
 *
 * @param {string} id   The id of the object to delete
 * The opts optional parameters currently accepts only 1 option:
 *   key: if provided, removes the given key instead of the default one (<collection>/<id>)
 * @param {object} [opts={}] optional options for the current operation
 * @returns {Promise}
 */
Repository.prototype.delete = function repositoryDelete (id, opts) {
  var promises = [];

  if (this.cacheEngine) {
    promises.push(this.deleteFromCache(id, opts));
  }
  if (this.databaseEngine) {
    promises.push(this.deleteFromDatabase(id));
  }

  return Promise.all(promises);
};


/**
 * Delete repository from database according to its id
 * @param id
 */
Repository.prototype.deleteFromDatabase = function repositoryDeleteFromDatabase (id) {
  return this.databaseEngine.delete(this.collection, id);
};

/**
 * Persists the given ObjectConstructor object in cache.
 * The opts optional parameters currently accept 2 options:
 *   key: if provided, stores the object to the given key instead of the default one (<collection>/<id>)
 *   ttl: if provided, overrides the default ttl set on the repository for the current operation.
 *
 * @param {object} object the object to persist
 * @param {object} opts optional options for the current operation
 * @returns {Promise}
 */
Repository.prototype.persistToCache = function repositoryPersistToCache (object, opts) {
  var
    options = opts || {},
    key = options.key || this.cacheKeyPrefix + object._id,
    ttl = this.ttl;

  if (options.ttl !== undefined) {
    ttl = options.ttl;
  }
  if (ttl === false) {
    return this.cacheEngine.set(key, JSON.stringify(this.serializeToCache(object)))
      .then(() => object);
  }

  return this.cacheEngine.volatileSet(key, JSON.stringify(this.serializeToCache(object)), ttl)
    .then(() => object);
};

/**
 * Removes the object from the Cache Engine
 * The opts optional parameters currently accepts only 1 option:
 *   key: if provided, removes the given key instead of the default one (<collection>/<id>)
 *
 * @param {string} id
 * @param {object} [opts={}] optional options for the current operation
 * @returns {Promise}
 */
Repository.prototype.deleteFromCache = function repositoryDeleteFromCache (id, opts) {
  var
    options = opts || {},
    key = options.key || this.cacheKeyPrefix + id;

  return this.cacheEngine.remove(key);
};

Repository.prototype.refreshCacheTTL = function repositoryRefreshCacheTTL (object, opts) {
  var
    options = opts || {},
    key = options.key || this.cacheKeyPrefix + object._id,
    ttl = this.ttl;

  if (options.ttl !== undefined) {
    ttl = options.ttl;
  }

  if (ttl === false) {
    return this.cacheEngine.persist(key);
  }

  return this.cacheEngine.expire(key, ttl);
};

Repository.prototype.expireFromCache = function repositoryExpireFromCache (object, opts) {
  var
    options = opts || {},
    key = options.key || this.cacheKeyPrefix + object._id;

  return this.cacheEngine.expire(key, -1);
};

/**
 * Serializes the object before being persisted to cache.
 *
 * @param {object} object The object to serialize
 * @returns {object}
 */
Repository.prototype.serializeToCache = function repositorySerializeToCache (object) {
  return _.assign({}, object);
};

/**
 * Serializes the object before being persisted to the database.
 *
 * @param {object} object The object to serialize
 * @returns {object}
 */
Repository.prototype.serializeToDatabase = function repositorySerializeToDatabase (object) {
  return object;
};

module.exports = Repository;
