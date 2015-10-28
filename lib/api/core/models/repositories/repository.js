var
  q = require('q'),
  RequestObject = require('../requestObject');

function Repository (kuzzle, options) {
  this.collection = options.collection;
  this.ObjectConstructor = options.ObjectConstructor;

  this.readEngine = options.readService || kuzzle.services.list.readEngine;
  this.writeEngine = options.writeService || kuzzle.services.list.writeEngine;
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
    action: 'get',
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
        var object = new this.ObjectConstructor();
        promises.push(this.hydrate(object, document));
      }.bind(this));

      q.all(promises)
        .then(function (results) {
          deferred.resolve(results);
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

Repository.prototype.loadFromCache = function (id) {
  var
    deferred = q.defer();

  this.cacheEngine.get(id)
    .then(function (response) {
      var object = new this.ObjectConstructor();
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

Repository.prototype.hydrate = function (object, data) {
  var
    deferred = q.defer();

  Object.keys(data).forEach(function (key) {
    object[key] = data[key];
  });
  deferred.resolve(object);

  return deferred.promise;
};

module.exports = Repository;
