var
  q = require('q'),
  ResponseObject = require('../core/models/responseObject');

module.exports = function AdminController (kuzzle) {
  /**
   * Delete the entire collection and associate mapping
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.deleteCollection = function (requestObject) {
    var deferred = q.defer();

    kuzzle.pluginsManager.trigger('data:deleteCollection', requestObject);

    deferred.resolve({});
    return deferred.promise;
  };

  /**
   * Add a mapping to the collection
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.putMapping = function (requestObject) {
    var deferred = q.defer();

    kuzzle.pluginsManager.trigger('data:putMapping', requestObject);

    deferred.resolve({});
    return deferred.promise;
  };

  /**
   * Get the collection mapping
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.getMapping = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:getMapping', requestObject);
    return kuzzle.services.list.readEngine.getMapping(requestObject);
  };

  /**
   * Returns the statistics frame from a date
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getStats = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:getStats', requestObject);
    return kuzzle.statistics.getStats(requestObject);
  };

  /**
   * Returns the last statistics frame
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getLastStats = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:getLastStats', requestObject);
    return kuzzle.statistics.getLastStats(requestObject);
  };

  /**
   * Returns all stored statistics frames
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getAllStats = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:getAllStats', requestObject);
    return kuzzle.statistics.getAllStats(requestObject);
  };

  /**
   * Reset a collection by removing all documents while keeping the existing mapping.
   *
   * @param {RequestObject} requestObject
   * @returns {promise}
   */
  this.truncateCollection = function (requestObject) {
    var deferred = q.defer();

    kuzzle.pluginsManager.trigger('data:truncateCollection', requestObject);

    deferred.resolve({});
    return deferred.promise;
  };

  /**
   * Create or update a Role
   * @param {RequestObject} requestObject
   * @returns {promise}
   */
  this.putRole = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:putRole', requestObject);

    return kuzzle.repositories.role.validateAndSaveRole(
      kuzzle.repositories.role.getRoleFromRequestObject(requestObject)
    )
      .then(result => {
        return Promise.resolve(new ResponseObject(requestObject, result));
      });
  };

  /**
   * Remove all rooms for a given collection
   * @param {RequestObject} requestObject
   * @returns {promise}
   */
  this.removeRooms = function (requestObject) {
    kuzzle.pluginsManager.trigger('subscription:removeAllRooms', requestObject);
    return kuzzle.hotelClerk.removeAllRooms(requestObject);
  };
};
