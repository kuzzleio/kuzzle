var
  _ = require('lodash'),
  internalIndex = require('rc')('kuzzle').internalIndex,
  cleanDB = require('../cleanDb'),
  prepareDb = require('../prepareDb');

module.exports = function AdminController (kuzzle) {
  /**
   * Delete the entire collection and associate mapping
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteCollection = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:deleteCollection', requestObject);
    return kuzzle.workerListener.add(requestObject)
      .then(response => {
        kuzzle.indexCache.remove(requestObject.index, requestObject.collection);
        return response;
      });
  };

  /**
   * Add a mapping to the collection
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.updateMapping = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:updateMapping', requestObject);
    return kuzzle.workerListener.add(requestObject)
      .then(response => {
        kuzzle.indexCache.add(requestObject.index, requestObject.collection);
        return response;
      });
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
   * Reset all indexes
   *
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteIndexes = function (requestObject, context) {
    return kuzzle.services.list.readEngine.listIndexes(requestObject)
      .then(response => {
        var
          availableIndexes = response.data.body.indexes,
          userRoles = context.token.user.profile.roles,
          allowedIndexes = [];

        if (response.data.body.indexes.length > 0) {
          userRoles.forEach(role => {
            if (role.indexes !== undefined) {
              _.forEach(role.indexes, (value, roleIndex) => {
                if (roleIndex.charAt(0) !== '_' && value._canDelete) {
                  availableIndexes.forEach(availableIndex => {
                    if ((availableIndex === roleIndex ||
                      roleIndex === '*' && availableIndex !== internalIndex) &&
                      _.indexOf(allowedIndexes, availableIndex) === -1
                    ) {
                      allowedIndexes.push(availableIndex);
                    }
                  });
                }
              });
            }
          });
        }

        requestObject.data.body.indexes = allowedIndexes;
        kuzzle.pluginsManager.trigger('data:deleteIndexes', requestObject);
        return kuzzle.workerListener.add(requestObject);
      })
      .then(response => {
        response.data.body.deleted.forEach(index => {
          kuzzle.indexCache.remove(index);
        });
        return response;
      });
  };

  /**
   * Create an empty index
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.createIndex = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:createIndex', requestObject);
    return kuzzle.workerListener.add(requestObject)
      .then(response => {
        kuzzle.indexCache.add(requestObject.index);
        return response;
      });
  };

  /**
   * Delete the entire index and associated collections
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteIndex = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:deleteIndex', requestObject);
    return kuzzle.workerListener.add(requestObject)
      .then(response => {
        kuzzle.indexCache.remove(requestObject.index);
        return response;
      });
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

  /**
   * Clean the whole database
   * @returns {Promise}
   */
  this.cleanDb = function (requestObject) {
    return cleanDB(kuzzle, true, true)
      .then((response) => {
        prepareDb(kuzzle, requestObject.data.body.fixtures, requestObject.data.body.mappings);
        return response;
      });
  };
};
