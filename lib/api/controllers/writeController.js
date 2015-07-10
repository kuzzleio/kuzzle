var
  _ = require('lodash'),
  async = require('async'),
  q = require('q');

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
        deferred.resolve({});

        if (!requestObject.isPersistent()) {
          return kuzzle.dsl.testFilters(requestObject);
        }
      })
      .then(function (rooms) {
        kuzzle.notifier.notify(rooms, requestObject);
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

    if (!requestObject.isValid()) {
      deferred.reject('The request object is not valid');
      return deferred.promise;
    }

    kuzzle.emit('data:update', requestObject);

    deferred.resolve({});
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