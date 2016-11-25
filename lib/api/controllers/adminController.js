var
  _ = require('lodash'),
  Promise = require('bluebird'),
  ResponseObject = require('kuzzle-common-objects').Models.responseObject,
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  PartialError = require('kuzzle-common-objects').Errors.partialError;


/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function AdminController(kuzzle) {
  var
    engine = kuzzle.services.list.storageEngine,
    internalEngine = kuzzle.internalEngine;

  /**
   * Add a mapping to the collection
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.updateMapping = function adminUpdateMapping (requestObject, userContext) {
    return engine.updateMapping(requestObject)
      .then(response => {
        kuzzle.indexCache.add(requestObject.index, requestObject.collection);

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, response),
          userContext
        });
      });
  };

  /**
   * Get the collection mapping
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.getMapping = function adminGetMapping (requestObject, userContext) {
    return engine.getMapping(requestObject)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };

  /**
   * Get the collection validation specifications
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.getSpecifications = function adminGetSpecifications (requestObject, userContext) {
    return internalEngine.get('validations', `${requestObject.index}#${requestObject.collection}`)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response._source),
        userContext
      }));
  };

  /**
   * Search for collection validation specifications
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.searchSpecifications = function adminSearchSpecifications (requestObject, userContext) {
    var
      query = {},
      from = 0,
      size = 20;

    if (requestObject.data.body) {
      if (requestObject.data.body.query) {
        query = requestObject.data.body.query;
      }
      if (requestObject.data.body.from) {
        from = requestObject.data.body.from;
      }
      if (requestObject.data.body.size) {
        size = requestObject.data.body.size;
      }
    }

    return internalEngine.search('validations', query, from, size)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };

  /**
   * Add a specification collections
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.updateSpecifications = function adminUpdateSpecifications (requestObject, userContext) {
    return prepareSpecificationValidation(requestObject, kuzzle)
      .then(specifications => {
        var promises = [];

        specifications.forEach(specification => {
          var specLogName = specification._id.split('#').join(' / ');

          promises.push(internalEngine.createOrReplace('validations', specification._id, specification._source));
          Promise.resolve(`Validation specification for ${specLogName} is about to be stored.`, userContext);
        });

        return Promise.all(promises);
      })
      .then(() => kuzzle.internalEngine.refresh())
      .then(() => kuzzle.validation.curateSpecification())
      .then(() => Promise.resolve({
        responseObject: new ResponseObject(requestObject, requestObject.data.body),
        userContext
      }));
  };

  /**
   * Add a specification collections
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.deleteSpecifications = function adminDeleteSpecifications (requestObject, userContext) {
    if (kuzzle.validation.specification[requestObject.index] === undefined || kuzzle.validation.specification[requestObject.index][requestObject.collection] === undefined) {
      // There was no specification for this collection
      return Promise.reject({
        responseObject: new ResponseObject(requestObject, {}),
        userContext
      });
    }

    return internalEngine.delete('validations', `${requestObject.index}#${requestObject.collection}`)
      .then(() => {
        Promise.resolve(`Validation specification for ${requestObject.index}#${requestObject.collection} has been deleted.`);

        return Promise.resolve();
      })
      .then(() => kuzzle.internalEngine.refresh())
      .then(() => kuzzle.validation.curateSpecification())
      .then(() => Promise.resolve({
        responseObject: new ResponseObject(requestObject, {}),
        userContext
      }));
  };

  /**
   * Validate a specification
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.validateSpecifications = function adminValidateSpecifications (requestObject, userContext) {
    return prepareSpecificationValidation(requestObject, kuzzle)
      .then(response => {
        if (response.error) {
          return Promise.resolve(response.responseObject);
        }

        return Promise.resolve(requestObject.data.body);
      })
      .then(response => {
        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, response),
          userContext
        });
      });
  };

  /**
   * Returns the statistics frame from a date
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getStats = function adminGetStats (requestObject, userContext) {
    return kuzzle.statistics.getStats(requestObject)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext: userContext
      }));
  };

  /**
   * Returns the last statistics frame
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getLastStats = function adminGetLastStats (requestObject, userContext) {
    return kuzzle.statistics.getLastStats()
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };

  /**
   * Returns all stored statistics frames
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getAllStats = function adminGetAllStats (requestObject, userContext) {
    return kuzzle.statistics.getAllStats(requestObject)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };

  /**
   * Returns the Kuzzle configuration
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getConfig = function adminGetConfig (requestObject, userContext) {
    var
      pluginsConfig = {},
      promises = [];

    Object.keys(kuzzle.pluginsManager.plugins).forEach(id => {
      promises.push(kuzzle.internalEngine.get('plugins', id));
    });

    return Promise.all(promises)
      .then(responses => {
        responses.forEach(entry => {
          pluginsConfig[entry._id] = entry._source;
        });
        return {
          kuzzle: _.assignIn({}, kuzzle.config),
          plugins: {
            config: pluginsConfig,
            routes: _.assignIn([], kuzzle.pluginsManager.routes)
          }
        };
      })
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext: userContext
      }));
  };

  /**
   * Reset a collection by removing all documents while keeping the existing mapping.
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.truncateCollection = function adminTruncateCollection (requestObject, userContext) {
    return engine.truncateCollection(requestObject)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext: userContext
      }));
  };

  /**
   * Reset all indexes
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.deleteIndexes = function adminDeleteIndexes (requestObject, userContext) {
    var
      allowedIndexes = [],
      indexes;

    return engine.listIndexes()
      .then(res => {
        indexes = res.indexes.filter(index => _.includes(requestObject.data.body.indexes, index));

        return kuzzle.repositories.user.load(userContext.token.userId);
      })
      .then(user => {
        var promises = indexes.map(index => user.isActionAllowed({
          controller: 'admin',
          action: 'deleteIndex',
          index
        }, userContext, kuzzle)
          .then(isAllowed => {
            if (isAllowed) {
              allowedIndexes.push(index);
            }
          }));

        return Promise.all(promises);
      })
      .then(() => {
        requestObject.data.body.indexes = allowedIndexes;

        return Promise.resolve();
      })
      .then(() => {
        return engine.deleteIndexes(requestObject);
      })
      .then(response => {
        var responseObject = new ResponseObject(requestObject, response);

        response.deleted.forEach(index => kuzzle.indexCache.remove(index));

        return Promise.resolve({
          responseObject,
          userContext
        });
      });
  };

  /**
   * Create an empty index
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.createIndex = function adminCreateIndex (requestObject, userContext) {
    return engine.createIndex(requestObject)
      .then(response => {
        kuzzle.indexCache.add(requestObject.index);

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, response),
          userContext: userContext
        });
      });
  };

  /**
   * Delete the entire index and associated collections
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.deleteIndex = function adminDeleteIndex (requestObject, userContext) {
    return engine.deleteIndex(requestObject)
      .then(response => {
        kuzzle.indexCache.remove(requestObject.index);

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, response),
          userContext: userContext
        });
      });
  };

  /**
   * Remove all rooms for a given collection
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.removeRooms = function adminRemoveRooms (requestObject, userContext) {
    return kuzzle.hotelClerk.removeRooms(requestObject)
      .then(response => {
        var responseObject = new ResponseObject(requestObject, response);

        if (response.partialErrors && response.partialErrors.length > 0) {
          responseObject.error = new PartialError('Some errors with provided rooms', response.partialErrors);
          responseObject.status = responseObject.error.status;
        }

        return Promise.resolve({
          responseObject,
          userContext: userContext
        });
      });
  };

  /**
   * Forces the refresh of the given index.
   * /!\ Can lead to some performances issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.refreshIndex = function adminRefreshIndex (requestObject, userContext) {
    return engine.refreshIndex(requestObject)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext: userContext
      }));
  };

  /**
   * Forces the refresh of the internal index.
   * /!\ Can lead to some performances issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.refreshInternalIndex = function adminRefreshInternalIndex (requestObject, userContext) {
    return kuzzle.internalEngine.refresh()
      .then(() => Promise.resolve({
        responseObject: new ResponseObject(requestObject, {acknowledged: true}),
        userContext: userContext
      }));
  };

  /**
   * Gets the current autoRefresh value for the current index.
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Object}
   */
  this.getAutoRefresh = function adminGetAutoRefresh (requestObject, userContext) {
    return engine.getAutoRefresh(requestObject)
      .then(response => {
        response.responseObject.data.body = response.responseObject.data.body.response;

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, {response}),
          userContext: userContext
        });
      });
  };

  /**
   * Sets elasticsearch autorefresh on/off for current index.
   * /!\ Can lead to some performances issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Object}
   */
  this.setAutoRefresh = function adminSetAutoRefresh (requestObject, userContext) {
    if (requestObject.data.body.autoRefresh === undefined) {
      throw new BadRequestError('mandatory parameter "autoRefresh" not found.');
    }
    if (typeof requestObject.data.body.autoRefresh !== 'boolean') {
      throw new BadRequestError('Invalid type for autoRefresh, expected Boolean got ' + typeof requestObject.data.body.autoRefresh);
    }

    return engine.setAutoRefresh(requestObject)
      .then(response => {
        response.responseObject.data.body = response.responseObject.data.body.response;

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, {response}),
          userContext: userContext
        });
      });
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Object}
   */
  this.createFirstAdmin = function adminCreateFirstAdmin (requestObject, userContext) {
    var reset = requestObject.data.body.reset || false;

    return this.adminExists()
      .then(adminExists => {

        delete requestObject.data.body.reset;
        requestObject.data.body.profileIds = ['admin'];

        if (adminExists.data.body.exists) {
          return Promise.reject(new Error('admin user is already set'));
        }

        return kuzzle.funnel.controllers.security.createOrReplaceUser(requestObject, userContext);
      })
      .then(response => {
        if (reset) {
          return resetRoles.call(kuzzle)
            .then(() => resetProfiles.call(kuzzle))
            .then(() => this.refreshIndex(new RequestObject({index: '%kuzzle'})))
            .then(() => Promise.resolve({
              responseObject: new ResponseObject(requestObject, response),
              userContext: userContext
            }));
        }

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, response),
          userContext: userContext
        });
      });
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Object}
   */
  this.adminExists = function adminExists (requestObject, userContext) {
    return kuzzle.internalEngine.bootstrap.adminExists()
      .then((response) => Promise.resolve({
        responseObject: new ResponseObject(requestObject, {exists: response}),
        userContext: userContext
      }));
  };
}

/**
 * @this {Kuzzle}
 * @returns {Promise.<*>}
 */
function resetRoles () {
  var promises;

  promises = ['admin', 'default', 'anonymous'].map(id => {
    return this.internalEngine.createOrReplace('roles', id, this.config.security.standard.roles[id]);
  });

  return Promise.all(promises);
}

/**
 * @this {Kuzzle}
 * @returns {Promise.<*>}
 */
function resetProfiles () {
  return this.internalEngine
    .createOrReplace('profiles', 'admin', {policies: [{roleId: 'admin', allowInternalIndex: true}]})
    .then(() => this.internalEngine.createOrReplace('profiles', 'anonymous', {policies: [{roleId: 'anonymous'}]}))
    .then(() => this.internalEngine.createOrReplace('profiles', 'default', {policies: [{roleId: 'default'}]}));
}

/**
 * @param {RequestObject} requestObject
 * @param {Kuzzle} kuzzle
 * @returns {*}
 */
function prepareSpecificationValidation(requestObject, kuzzle) {
  var specifications = [];

  return createSpecificationList(requestObject)
    .then(list => {
      specifications = list;
      return validateSpecificationList(kuzzle, list);
    })
    .then(response => {
      var
        error;

      if (response === true) {
        return Promise.resolve(specifications);
      }

      error = new BadRequestError('Some errors with provided specifications.');
      error.details = response;
      return Promise.reject(error);
    });
}

/**
 * @param {RequestObject} requestObject
 * @returns {Promise.<Array>}
 */
function createSpecificationList (requestObject) {
  var specifications = [];

  _.forEach(requestObject.data.body, (collections, index) => {
    _.forEach(collections, (validation, collection) => {
      specifications.push({
        _id: `${index}#${collection}`,
        _source: {
          validation: validation,
          index: index,
          collection: collection
        }
      });
    });
  });

  return Promise.resolve(specifications);
}

/**
 * @param kuzzle
 * @param list
 * @returns {Promise.<Boolean|Object>}
 */
function validateSpecificationList (kuzzle, list) {
  var
    promises = [],
    errors = [];

  list.forEach(specification => {
    promises.push(kuzzle.validation.isValidSpecification(specification._source.index, specification._source.collection, specification._source.validation, true));
  });

  return Promise.all(promises)
    .then(response => {
      if (_.every(response, 'isValid')) {
        return Promise.resolve(true);
      }
      response.forEach(value => {
        if (!value.isValid) {
          errors = Array.prototype.concat.apply(errors, value.errors);
        }
      });
      return Promise.resolve(errors);
    });
}

module.exports = AdminController;
