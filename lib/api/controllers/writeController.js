var
  q = require('q'),
  ResponseObject = require('../core/models/responseObject');

module.exports = function WriteController (kuzzle) {

  /**
   * Create a new document. If the requestObject is persistent, use the persistence layer or only notify users
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.create = function (requestObject) {
    var deferred = q.defer();

    requestObject.isValid()
      .then(function () {
        kuzzle.emit('data:create', requestObject);

        if (!requestObject.isPersistent()) {
          return kuzzle.dsl.testFilters(requestObject);
        }

        // simulate an empty result from dsl.testFilters
        return Promise.resolve([]);
      })
      .then(function (rooms) {
        if (rooms.length > 0) {
          kuzzle.notifier.notify(rooms, new ResponseObject(requestObject).toJson());
        }
        deferred.resolve({});
      })
      .catch(function (error) {
        kuzzle.log.error(error);
        deferred.reject(error);
      });

    return deferred.promise;
  };

  /**
   * Create a new document through the persistent layer. If it already exists, update it instead.
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.createOrUpdate = function (requestObject) {
    var deferred = q.defer();

    requestObject.isValid()
      .then(function () {
        kuzzle.emit('data:createOrUpdate', requestObject);
        deferred.resolve({});
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  };

  /**
   * Update a document through the persistent layer
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.update = function (requestObject) {
    var deferred = q.defer();

    requestObject.isValid()
      .then(function () {
        kuzzle.emit('data:update', requestObject);
        deferred.resolve({});
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  };

  /**
   * Delete a document through the persistent layer
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.delete = function (requestObject) {
    var deferred = q.defer();

    kuzzle.emit('data:delete', requestObject);
    deferred.resolve({});

    return deferred.promise;
  };

  /**
   * Delete several documents matching a filter through the persistent layer
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.deleteByQuery = function (requestObject) {
    var deferred = q.defer();

    kuzzle.emit('data:deleteByQuery', requestObject);
    deferred.resolve({});

    return deferred.promise;
  };
};
