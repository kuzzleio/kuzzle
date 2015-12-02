var
  q = require('q');

module.exports = function WriteController (kuzzle) {
  /**
   * Create a new document
   *
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.create = function (requestObject) {
    var deferred = q.defer();

    requestObject.isValid()
      .then(() => {
        kuzzle.pluginsManager.trigger('data:create', requestObject);
        deferred.resolve({});
      })
      .catch(error => deferred.reject(error));

    return deferred.promise;
  };

  /**
   * Publish a realtime message
   *
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.publish = function (requestObject) {
    var deferred = q.defer();

    requestObject.isValid()
      .then(() => {
        kuzzle.pluginsManager.trigger('data:publish', requestObject);
        return kuzzle.notifier.publish(requestObject);
      })
      .then(response => deferred.resolve(response))
      .catch(error => deferred.reject(error));

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
        kuzzle.pluginsManager.trigger('data:createOrUpdate', requestObject);
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
        kuzzle.pluginsManager.trigger('data:update', requestObject);
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

    kuzzle.pluginsManager.trigger('data:delete', requestObject);
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

    kuzzle.pluginsManager.trigger('data:deleteByQuery', requestObject);
    deferred.resolve({});

    return deferred.promise;
  };


  /**
   * Creates a new collection. Does nothing if the collection already exists.
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.createCollection = function (requestObject) {
    var deferred = q.defer();

    kuzzle.pluginsManager.trigger('data:createCollection', requestObject);

    deferred.resolve({});
    return deferred.promise;
  };
};
