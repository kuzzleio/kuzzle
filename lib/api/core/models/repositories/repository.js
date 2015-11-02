var
  _ = require('lodash'),
  q = require('q'),
  KuzzleError = require('../../errors/kuzzleError'),
  RequestObject = require('../requestObject');

function Repository (kuzzle, options) {
  this.collection = options.collection;
  this.ttl = options.ttl || 60;
  this.ObjectConstructor = options.ObjectConstructor;

  this.readEngine = options.readEngine || kuzzle.services.list.readEngine;
  this.writeEngine = options.writeEngine || kuzzle.services.list.writeEngine;
  this.cacheEngine = options.cacheEngine || kuzzle.services.list.internalCache;
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
    requestId: 'foo',
    collection: this.collection,
    body: {
      _id: id
    }
  });

  this.readEngine.get(requestObject)
    .then(function (response) {
      if (response.data) {
        result = new this.ObjectConstructor(this);
        this.hydrate(result, response.data)
          .then(function (object) {
            deferred.resolve(object);
          })
          .catch(function (error) {
            deferred.reject(error);
          });
      }
      else {
        deferred.resolve(null);
      }
    }.bind(this))
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
 * @returns {*|promise}
 */
Repository.prototype.loadMultiFromDatabase = function (ids) {
  var
    deferred = q.defer(),
    requestObject,
    promises;

  requestObject = new RequestObject({
    controller: 'read',
    action: 'mget',
    requestId: 'foo',
    collection: this.collection,
    body: {
      ids: ids
    }
  });

  this.readEngine.mget(requestObject)
    .then(function (response) {
      promises = [];

      response.data.docs.forEach(function (document) {
        var object;

        if (document instanceof KuzzleError) {
          promises.push(Promise.resolve(document));
        }
        else {
          object = new this.ObjectConstructor();
          promises.push(this.hydrate(object, document.data));
        }
      }.bind(this));

      deferred.resolve(q.all(promises));
    }.bind(this))
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
    key = options.key || this.collection + '/' + id;

  this.cacheEngine.get(key)
    .then(function (response) {
      var object = new this.ObjectConstructor();

      if (response === null) {
        deferred.resolve(null);
        return;
      }

      this.hydrate(object, response)
        .then(function (result) {
          deferred.resolve(result);
        })
        .catch(function (error) {
          deferred.reject(error);
        });
    }.bind(this))
    .catch(function (error) {
      deferred.reject(error);
    });

  return deferred.promise;
};

/**
 * From a poco object, hydrate a new ObjectConstructor one.
 *
 * @param {Object} object The Object to be hydrated
 * @param {Object} data The Plain object to  take the values from
 * @returns {Promise}
 */
Repository.prototype.hydrate = function (object, data) {
  var
    deferred = q.defer();

  Object.keys(data).forEach(function (key) {
    object[key] = data[key];
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
Repository.prototype.persistInDB = function (object) {
  var requestObject = new RequestObject({
    controller: 'write',
    action: 'createOrUpdate',
    requestId: 'foo',
    collection: this.collection
  });

  requestObject.body = this.serializeToDB(object);

  return this.writeEngine.createOrUpdate(requestObject);
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
Repository.prototype.persistInCache = function (object, opts) {
  var
    options = opts || {},
    key = options.key || this.collection + '/' + object._id,
    ttl = options.ttl || this.ttl;

  if (ttl === false) {
    return this.cacheEngine.set(key, this.serializeToCache(object));
  }

  return this.cacheEngine.volatileSet(key, this.serializeToCache(object), ttl);
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
Repository.prototype.serializeToDB = function (object) {
 return object;
};

module.exports = Repository;
