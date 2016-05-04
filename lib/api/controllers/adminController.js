var
  _ = require('lodash'),
  ResponseObject = require('../core/models/responseObject'),
  BadRequestError = require('../core/errors/badRequestError'),
  PartialError = require('../core/errors/partialError'),
  internalIndex = require('rc')('kuzzle').internalIndex;

module.exports = function AdminController (kuzzle) {
  /**
   * Add a mapping to the collection
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.updateMapping = function (requestObject) {
    var
      modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeUpdateMapping', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.workerListener.add(modifiedRequestObject);
      })
      .then(response => {
        kuzzle.indexCache.add(modifiedRequestObject.index, modifiedRequestObject.collection);
        return kuzzle.pluginsManager.trigger('data:afterUpdateMapping', new ResponseObject(modifiedRequestObject, response));
      });
  };

  /**
   * Get the collection mapping
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.getMapping = function (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetMapping', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        return kuzzle.services.list.readEngine.getMapping(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetMapping', new ResponseObject(modifiedRequestObject, response)));
  };

  /**
   * Returns the statistics frame from a date
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getStats = function (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetStats', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.statistics.getStats(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetStats', new ResponseObject(modifiedRequestObject, response)));
  };

  /**
   * Returns the last statistics frame
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getLastStats = function (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetLastStats', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.statistics.getLastStats();
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetLastStats', new ResponseObject(modifiedRequestObject, response)));
  };

  /**
   * Returns all stored statistics frames
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getAllStats = function (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetAllStats', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.statistics.getAllStats(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetAllStats', new ResponseObject(modifiedRequestObject, response)));
  };

  /**
   * Reset a collection by removing all documents while keeping the existing mapping.
   *
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.truncateCollection = function (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeTruncateCollection', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.workerListener.add(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterTruncateCollection', new ResponseObject(modifiedRequestObject, response)));
  };

  /**
   * Reset all indexes
   *
   * @param {RequestObject} requestObject
   * @param {Context} context
   * @returns {Promise}
   */
  this.deleteIndexes = function (requestObject, context) {
    var modifiedRequestObject = null;

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
        return kuzzle.pluginsManager.trigger('data:beforeDeleteIndexes', requestObject);
      })
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.workerListener.add(modifiedRequestObject);
      })
      .then(response => {
        var responseObject = new ResponseObject(modifiedRequestObject, response);

        response.deleted.forEach(index => kuzzle.indexCache.remove(index));

        return kuzzle.pluginsManager.trigger('data:beforeDeleteIndexes', responseObject);
      });
  };

  /**
   * Create an empty index
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.createIndex = function (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeCreateIndex', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.workerListener.add(modifiedRequestObject);
      })
      .then(response => {
        kuzzle.indexCache.add(modifiedRequestObject.index);
        return kuzzle.pluginsManager.trigger('data:afterCreateIndex', new ResponseObject(modifiedRequestObject, response));
      });
  };

  /**
   * Delete the entire index and associated collections
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteIndex = function (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeDeleteIndex', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.workerListener.add(modifiedRequestObject);
      })
      .then(response => {
        kuzzle.indexCache.remove(modifiedRequestObject.index);
        return kuzzle.pluginsManager.trigger('data:afterDeleteIndex', new ResponseObject(modifiedRequestObject, response));
      });
  };

  /**
   * Remove all rooms for a given collection
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.removeRooms = function (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('subscription:beforeRemoveRooms', requestObject)
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

        return kuzzle.pluginsManager.trigger('subscription:afterRemoveRooms', responseObject);
      });
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
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeRefreshIndex', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.workerListener.add(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterRefreshIndex', new ResponseObject(modifiedRequestObject, response)));
  };

  /**
   * Gets the current autoRefresh value for the current index.
   *
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.getAutoRefresh = function (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetAutoRefresh', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        // even if being a get method, the autorefresh is set in the worker side
        // we need to ask it the status
        return kuzzle.workerListener.add(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetAutoRefresh', new ResponseObject(modifiedRequestObject, response)))
      .then(response => {
        response.data.body = response.data.body.response;
        return response;
      });
  };

  /**
   * Sets elasticsearch autorefresh on/off for current index.
   * /!\ Can lead to some performances issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html
   *
   * @param {RequestObject} requestObject
   * @returns {*}
   */
  this.setAutoRefresh = function (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeSetAutoRefresh', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        if (newRequestObject.data.body.autoRefresh === undefined) {
          throw new BadRequestError('mandatory parameter "autoRefresh" not found.');
        }
        if (typeof newRequestObject.data.body.autoRefresh !== 'boolean') {
          throw new BadRequestError('Invalid type for autoRefresh, expected Boolean got ' + typeof newRequestObject.data.body.autoRefresh);
        }

        return kuzzle.workerListener.add(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterSetAutoRefresh', new ResponseObject(modifiedRequestObject, response)))
      .then(response => {
        response.data.body = response.data.body.response;
        return response;
      });
  };
};
