var
  _ = require('lodash'),
  q = require('q'),
  InternalError = require('../../errors/internalError'),
  RequestObject = require('../requestObject'),
  ResponseObject = require('../responseObject');

function Repository (kuzzle, options) {
  this.collection = options.collection;
  this.index = options.index;
  this.ttl = options.ttl || kuzzle.config.repositories.cacheTTL;
  this.ObjectConstructor = options.ObjectConstructor;
  this.writeLayer = options.writeLayer;

  this.readEngine = options.readEngine || kuzzle.services.list.readEngine;
  this.cacheEngine = options.cacheEngine || kuzzle.services.list.internalCache;

  /*
    If no custom write engine layer is provided, fallback to the standard Kuzzle write workers
   */
  if (!this.writeLayer) {
    this.writeLayer = {
      execute: function (requestObject) {
        kuzzle.pluginsManager.trigger('data:' + requestObject.action, requestObject);
        return kuzzle.workerListener.add(requestObject);
      }
    };
  }
}

/**
 *
 * @param {string} id
 * @returns {Promise} resolves on a new ObjectConstructor()
 */
Repository.prototype.loadOneFromDatabase = function (id) {
  var
    deferred = q.defer(),
    requestObject,
    result;

  requestObject = new RequestObject({
    controller: 'read',
    action: 'get',
    collection: this.collection,
    index: this.index,
    body: {
      _id: id
    }
  });

  this.readEngine.get(requestObject)
    .then(response => {
      if (response.data) {
        result = new this.ObjectConstructor();
        deferred.resolve(this.hydrate(result, response));
      }
      else {
        deferred.resolve(null);
      }
    })
    .catch(function (error) {
      if (error.status === 404) {
        // no content found, we return null without failing
        deferred.resolve(null);
      }
      else {
        deferred.reject(error);
      }
    });

  return deferred.promise;
};

/**
 *
 * @param ids
 * @param {Boolean} hydrate
 * @returns {*|promise}
 */
Repository.prototype.loadMultiFromDatabase = function (ids, hydrate) {
  var
    deferred = q.defer(),
    requestObject,
    promises;

  requestObject = new RequestObject({
    controller: 'read',
    action: 'mget',
    collection: this.collection,
    index: this.index,
    body: {
      ids: ids
    }
  });

  this.readEngine.mget(requestObject)
    .then(response => {
      promises = [];

      if (!hydrate || !response.data || !response.data.body.docs) {
        return deferred.resolve(
          response.data.body.docs
            .filter(document => document.found) // keep only document with attribute found to true
            .map((document) => { // map the document in order to keep only _id and _source
              return {
                _id: document._id,
                _source: document._source
              };
            })
        );
      }

      response.data.body.docs.forEach(document => {
        var
          object,
          data;

        if (document.found) {
          object = new this.ObjectConstructor();
          data = _.extend({}, document._source);
          data._id = document._id;

          promises.push(this.hydrate(object, data));
        }
      });

      deferred.resolve(q.all(promises));
    })
    .catch(function (error) {
      deferred.reject(error);
    });

  return deferred.promise;
};

/**
 * Search in database corresponding repository according to a filter
 *
 * @param {Object} filter
 * @param {Number} from manage pagination
 * @param {Number} size manage pagination
 * @param {Boolean} hydrate. True if the result must be hydrated
 *
 * @returns {promise}
 */
Repository.prototype.search = function (filter, from, size, hydrate) {
  var
    deferred = q.defer(),
    promises,
    requestObject;

  requestObject = new RequestObject({
    controller: 'read',
    action: 'search',
    collection: this.collection,
    index: this.index,
    body: {
      filter: filter,
      from: from || 0,
      size: size || 20
    }
  });

  this.readEngine.search(requestObject)
    .then(response => {
      promises = [];

      if (!hydrate || !response.data || !response.data.body.hits) {
        return deferred.resolve(response.data.body.hits.map((document) => {
          return {
            _id: document._id,
            _source: document._source
          };
        }));
      }

      response.data.body.hits.forEach(document => {
        var
          object,
          data;

        object = new this.ObjectConstructor();
        data = _.extend({}, document._source);
        data._id = document._id;

        promises.push(this.hydrate(object, data));
      });

      deferred.resolve(q.all(promises));
    })
    .catch(function (error) {
      deferred.reject(error);
    });

  return deferred.promise;
};

/**
 * Loads an object from Cache. Returns a promise that resolves either to the
 * retrieved object of null in case it is not found.
 *
 * The opts object currently accepts one optional parameter: key, which forces
 * the cache key to fetch.
 * In case the key is not provided, it defauls to <collection>/id, i.e.: _kuzzle/users/12
 *
 * @param {String} id The id of the object to get
 * @param {Object} opts Optional options.
 * @returns {Promise}
 */
Repository.prototype.loadFromCache = function (id, opts) {
  var
    deferred = q.defer(),
    options = opts || {},
    key = options.key || this.index + '/' + this.collection + '/' + id;

  this.cacheEngine.get(key)
    .then(response => {
      var object = new this.ObjectConstructor();

      if (response === null) {
        deferred.resolve(null);
        return;
      }
      response = JSON.parse(response);
      this.hydrate(object, response)
        .then(function (result) {
          deferred.resolve(result);
        })
        .catch(function (error) {
          deferred.reject(error);
        });
    })
    .catch(function (error) {
      deferred.reject(error);
    });

  return deferred.promise;
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
 * @param {String} id The id of the object to get
 * @param {Object} opts Optional options.
 * @returns {Promise}
 */
Repository.prototype.load = function (id, opts) {
  var deferred = q.defer();

  if (!this.cacheEngine) {
    return this.loadOneFromDatabase(id);
  }

  this.loadFromCache(id, opts)
    .then(function (object) {
      if (object === null) {
        if (!Boolean(this.readEngine)) {
          deferred.resolve(null);
          return deferred.promise;
        }
        this.loadOneFromDatabase(id)
          .then(function (objectFromDatabase) {
            if (objectFromDatabase !== null) {
              this.persistToCache(objectFromDatabase);
            }
            deferred.resolve(objectFromDatabase);
          }.bind(this))
          .catch(function (err) {
            deferred.reject(err);
          });
      }
      else {
        this.refreshCacheTTL(object);
        deferred.resolve(object);
      }
    }.bind(this))
    .catch(function (err) {
      deferred.reject(err);
    });
  return deferred.promise;
};

/**
 * From a pojo object, hydrate an ObjectConstructor one.
 *
 * @param {Object} object The Object to be hydrated
 * @param {Object} data The Plain object to  take the values from
 * @returns {Promise}
 */
Repository.prototype.hydrate = function (object, data) {
  var
    deferred = q.defer(),
    o = {};

  if (data instanceof ResponseObject) {
    if (Boolean(data.toJson().result._source)) {
      o = _.extend(o, data.toJson().result._source);
    }
    else {
      o = _.extend(o, data.toJson().result);
    }
  }
  else {
    o = data;
  }

  if (!_.isObject(o)) {
    deferred.reject(new InternalError('Error hydrating object ' + object.toString() + '. Data parameter is not an object'));
  }

  Object.keys(o).forEach(function (key) {
    object[key] = o[key];
  });
  deferred.resolve(object);

  return deferred.promise;
};

/**
 * Persists the given object in the collection that is attached to the repository.
 *
 * @param {ObjectConstructor} object The object to persist
 * @returns {Promise}
 */
Repository.prototype.persistToDatabase = function (object) {
  var requestObject = new RequestObject({
    controller: 'write',
    action: 'createOrUpdate',
    collection: this.collection,
    index: this.index,
    _id: object._id,
    body: this.serializeToDatabase(object)
  });

  return this.writeLayer.execute(requestObject);
};

/**
 * Delete repository from database according to its id
 * @param id
 */
Repository.prototype.deleteFromDatabase = function (id) {
  var
    requestObject;

  requestObject = new RequestObject({
    controller: 'write',
    action: 'delete',
    collection: this.collection,
    index: this.index,
    body: {
      _id: id
    }
  });

  return this.writeLayer.execute(requestObject);
};

/**
 * Persists the given ObjectConstructor object in cache.
 * The opts optional parameters currently accept 2 options:
 *   key: if provided, stores the object to the given key instead of the default one (<collection>/<id>)
 *   ttl: if provided, overrides the default ttl set on the repository for the current operation.
 *
 * @param {Object} object the object to persist
 * @param {Object} opts optional options for the current operation
 * @returns {Promise}
 */
Repository.prototype.persistToCache = function (object, opts) {
  var
    options = opts || {},
    key = options.key || this.index + '/' + this.collection + '/' + object._id,
    ttl = this.ttl;

  if (options.ttl !== undefined) {
    ttl = options.ttl;
  }

  if (ttl === false) {
    return this.cacheEngine.set(key, JSON.stringify(this.serializeToCache(object)));
  }

  return this.cacheEngine.volatileSet(key, JSON.stringify(this.serializeToCache(object)), ttl);
};

Repository.prototype.refreshCacheTTL = function (object, opts) {
  var
    options = opts || {},
    key = options.key || this.index + '/' + this.collection + '/' + object._id,
    ttl = this.ttl;

  if (options.ttl !== undefined) {
    ttl = options.ttl;
  }

  if (ttl === false) {
    return this.cacheEngine.persist(key);
  }

  return this.cacheEngine.expire(key, ttl);
};

Repository.prototype.expireFromCache = function (object, opts) {
  var
    options = opts || {},
    key = options.key || this.index + '/' + this.collection + '/' + object._id;

  return this.cacheEngine.expire(key, -1);
};

/**
 * Serializes the object before being persisted to cache.
 *
 * @param {Object} object The object to serialize
 * @returns {Object}
 */
Repository.prototype.serializeToCache = function (object) {
  return object;
};

/**
 * Serializes the object before being persisted to the database.
 *
 * @param {Object} object The object to serialize
 * @returns {Object}
 */
Repository.prototype.serializeToDatabase = function (object) {
  return object;
};

module.exports = Repository;
