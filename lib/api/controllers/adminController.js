var
  _ = require('lodash'),
  q = require('q'),
  ResponseObject = require('../core/models/responseObject'),
  PartialError = require('../core/errors/partialError'),
  internalIndex = require('rc')('kuzzle').internalIndex;

module.exports = function AdminController (kuzzle) {
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
        return new ResponseObject(requestObject, response);
      })
      .catch(err => q.reject(new ResponseObject(requestObject, err)));
  };

  /**
   * Get the collection mapping
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.getMapping = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:getMapping', requestObject);
    return kuzzle.services.list.readEngine.getMapping(requestObject)
      .then(response => new ResponseObject(requestObject, response))
      .catch(err => q.reject(new ResponseObject(requestObject, err)));
  };

  /**
   * Returns the statistics frame from a date
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getStats = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:getStats', requestObject);
    return kuzzle.statistics.getStats(requestObject)
      .then(response => new ResponseObject(requestObject, response))
      .catch(err => q.reject(new ResponseObject(requestObject, err)));
  };

  /**
   * Returns the last statistics frame
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getLastStats = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:getLastStats', requestObject);
    return kuzzle.statistics.getLastStats()
      .then(response => new ResponseObject(requestObject, response))
      .catch(err => q.reject(new ResponseObject(requestObject, err)));
  };

  /**
   * Returns all stored statistics frames
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getAllStats = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:getAllStats', requestObject);
    return kuzzle.statistics.getAllStats(requestObject)
      .then(response => new ResponseObject(requestObject, response))
      .catch(err => q.reject(new ResponseObject(requestObject, err)));
  };

  /**
   * Reset a collection by removing all documents while keeping the existing mapping.
   *
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.truncateCollection = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:truncateCollection', requestObject);
    return kuzzle.workerListener.add(requestObject)
      .then(response => new ResponseObject(requestObject, response))
      .catch(err => q.reject(new ResponseObject(requestObject, err)));
  };

  /**
   * Reset all indexes
   *
   * @param {RequestObject} requestObject
   * @param {Context} context
   * @returns {Promise}
   */
  this.deleteIndexes = function (requestObject, context) {
    return kuzzle.services.list.readEngine.listIndexes()
      .then(response => {
        var
          availableIndexes = response.indexes,
          userRoles = context.token.user.profile.roles,
          allowedIndexes = [];

        if (availableIndexes.length > 0) {
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
        var responseObject = new ResponseObject(requestObject, response);

        response.deleted.forEach(index => kuzzle.indexCache.remove(index));

        return responseObject;
      })
      .catch(err => q.reject(new ResponseObject(requestObject, err)));
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
        return new ResponseObject(requestObject, response);
      })
      .catch(err => q.reject(new ResponseObject(requestObject, err)));
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
        return new ResponseObject(requestObject, response);
      })
      .catch(err => q.reject(new ResponseObject(requestObject, err)));
  };

  /**
   * Remove all rooms for a given collection
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.removeRooms = function (requestObject) {
    kuzzle.pluginsManager.trigger('subscription:removeRooms', requestObject);
    return kuzzle.hotelClerk.removeRooms(requestObject)
      .then(response => {
        var responseObject = new ResponseObject(requestObject, response);

        if (response.partialErrors && response.partialErrors.length > 0) {
          responseObject.error = new PartialError('Some errors with provided rooms', response.partialErrors);
          responseObject.status = responseObject.error.status;
        }

        return responseObject;
      })
      .catch(err => q.reject(new ResponseObject(requestObject, err)));
  };

  /**
   * Forces the refresh of the given index.
   * /!\ Can lead to some performances issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html
   *
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.refreshIndex = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:refreshIndex', requestObject);
    return kuzzle.workerListener.add(requestObject)
      .then(response => new ResponseObject(requestObject, response))
      .catch(err => q.reject(new ResponseObject(requestObject, err)));
  };
};
