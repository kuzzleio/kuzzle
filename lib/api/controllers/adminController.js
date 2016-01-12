module.exports = function AdminController (kuzzle) {
  /**
   * Delete the entire collection and associate mapping
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteCollection = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:deleteCollection', requestObject);
    return kuzzle.workerListener.add(requestObject);
  };

  /**
   * Add a mapping to the collection
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.putMapping = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:putMapping', requestObject);
    return kuzzle.workerListener.add(requestObject);
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
   * @returns {Promise}
   */
  this.truncateCollection = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:truncateCollection', requestObject);
    return kuzzle.workerListener.add(requestObject);
  };

  /**
   * Create or update a Role
   * @param {RequestObject} requestObject
   * @returns {Promise}
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
   * Reset all indexes
   *
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteIndexes = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:deleteIndexes', requestObject);
    return kuzzle.workerListener.add(requestObject);
  };

  /**
   * Create an empty index
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.createIndex = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:createIndex', requestObject);
    return kuzzle.workerListener.add(requestObject);
  };

  /**
   * Delete the entire index and associated collections
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteIndex = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:deleteIndex', requestObject);
    return kuzzle.workerListener.add(requestObject);
  };

  /**
   * Remove all rooms for a given collection
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.removeRooms = function (requestObject) {
    kuzzle.pluginsManager.trigger('subscription:removeRooms', requestObject);
    return kuzzle.hotelClerk.removeRooms(requestObject);
  };
};
