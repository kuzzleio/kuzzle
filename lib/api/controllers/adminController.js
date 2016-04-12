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
    var modifiedRequestObject;

    return kuzzle.pluginsManager.trigger('data:updateMapping', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.workerListener.add(modifiedRequestObject);
      })
      .then(response => {
        kuzzle.indexCache.add(modifiedRequestObject.index, modifiedRequestObject.collection);
        return new ResponseObject(modifiedRequestObject, response);
      })
      .catch(err => q.reject(new ResponseObject(modifiedRequestObject, err)));
  };

  /**
   * Get the collection mapping
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.getMapping = function (requestObject) {
    var modifiedRequestObject;

    return kuzzle.pluginsManager.trigger('data:getMapping', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.services.list.readEngine.getMapping(modifiedRequestObject);
      })
      .then(response => new ResponseObject(modifiedRequestObject, response))
      .catch(err => q.reject(new ResponseObject(modifiedRequestObject, err)));
  };

  /**
   * Returns the statistics frame from a date
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getStats = function (requestObject) {
    var modifiedRequestObject;

    return kuzzle.pluginsManager.trigger('data:getStats', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.statistics.getStats(modifiedRequestObject);
      })
      .then(response => new ResponseObject(modifiedRequestObject, response))
      .catch(err => q.reject(new ResponseObject(modifiedRequestObject, err)));
  };

  /**
   * Returns the last statistics frame
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getLastStats = function (requestObject) {
    var modifiedRequestObject;

    return kuzzle.pluginsManager.trigger('data:getLastStats', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.statistics.getLastStats();
      })
      .then(response => new ResponseObject(modifiedRequestObject, response))
      .catch(err => q.reject(new ResponseObject(modifiedRequestObject, err)));
  };

  /**
   * Returns all stored statistics frames
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getAllStats = function (requestObject) {
    var modifiedRequestObject;

    return kuzzle.pluginsManager.trigger('data:getAllStats', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.statistics.getAllStats(modifiedRequestObject);
      })
      .then(response => new ResponseObject(modifiedRequestObject, response))
      .catch(err => q.reject(new ResponseObject(modifiedRequestObject, err)));
  };

  /**
   * Reset a collection by removing all documents while keeping the existing mapping.
   *
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.truncateCollection = function (requestObject) {
    var modifiedRequestObject;

    return kuzzle.pluginsManager.trigger('data:truncateCollection', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.workerListener.add(modifiedRequestObject);
      })
      .then(response => new ResponseObject(modifiedRequestObject, response))
      .catch(err => q.reject(new ResponseObject(modifiedRequestObject, err)));
  };

  /**
   * Reset all indexes
   *
   * @param {RequestObject} requestObject
   * @param {Context} context
   * @returns {Promise}
   */
  this.deleteIndexes = function (requestObject, context) {
    var modifiedRequestObject;

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
        return kuzzle.pluginsManager.trigger('data:deleteIndexes', requestObject);
      })
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.workerListener.add(modifiedRequestObject);
      })
      .then(response => {
        var responseObject = new ResponseObject(modifiedRequestObject, response);

        response.deleted.forEach(index => kuzzle.indexCache.remove(index));

        return responseObject;
      })
      .catch(err => q.reject(new ResponseObject(modifiedRequestObject, err)));
  };

  /**
   * Create an empty index
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.createIndex = function (requestObject) {
    var modifiedRequestObject;

    return kuzzle.pluginsManager.trigger('data:createIndex', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.workerListener.add(modifiedRequestObject);
      })
      .then(response => {
        kuzzle.indexCache.add(modifiedRequestObject.index);
        return new ResponseObject(modifiedRequestObject, response);
      })
      .catch(err => q.reject(new ResponseObject(modifiedRequestObject, err)));
  };

  /**
   * Delete the entire index and associated collections
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteIndex = function (requestObject) {
    var modifiedRequestObject;

    return kuzzle.pluginsManager.trigger('data:deleteIndex', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.workerListener.add(modifiedRequestObject);
      })
      .then(response => {
        kuzzle.indexCache.remove(modifiedRequestObject.index);
        return new ResponseObject(modifiedRequestObject, response);
      })
      .catch(err => q.reject(new ResponseObject(modifiedRequestObject, err)));
  };

  /**
   * Remove all rooms for a given collection
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.removeRooms = function (requestObject) {
    var modifiedRequestObject;

    return kuzzle.pluginsManager.trigger('subscription:removeRooms', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.hotelClerk.removeRooms(modifiedRequestObject);
      })
      .then(response => {
        var responseObject = new ResponseObject(modifiedRequestObject, response);

        if (response.partialErrors && response.partialErrors.length > 0) {
          responseObject.error = new PartialError('Some errors with provided rooms', response.partialErrors);
          responseObject.status = responseObject.error.status;
        }

        return responseObject;
      })
      .catch(err => q.reject(new ResponseObject(modifiedRequestObject, err)));
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
    var modifiedRequestObject;

    return kuzzle.pluginsManager.trigger('data:refreshIndex', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.workerListener.add(modifiedRequestObject);
      })
      .then(response => new ResponseObject(modifiedRequestObject, response))
      .catch(err => q.reject(new ResponseObject(modifiedRequestObject, err)));
  };
};
