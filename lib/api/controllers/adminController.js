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
   * @returns {Promise}
   */
  this.updateMapping = function adminUpdateMapping (requestObject) {
    var
      modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeUpdateMapping', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.updateMapping(modifiedRequestObject);
      })
      .then(response => {
        kuzzle.indexCache.add(modifiedRequestObject.index, modifiedRequestObject.collection);
        return kuzzle.pluginsManager.trigger('data:afterUpdateMapping', new ResponseObject(modifiedRequestObject, response));
      });
  };

  /**
   * Get the collection mapping
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.getMapping = function adminGetMapping (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetMapping', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.getMapping(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetMapping', new ResponseObject(modifiedRequestObject, response)));
  };

  /**
   * Get the collection validation specifications
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.getSpecifications = function adminGetSpecifications (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetSpecifications', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return internalEngine.get('validations', `${modifiedRequestObject.index}#${modifiedRequestObject.collection}`);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetSpecifications', new ResponseObject(modifiedRequestObject, response._source)));
  };

  /**
   * Add a specification collections
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.updateSpecifications = function adminUpdateSpecifications (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeUpdateSpecifications', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        return prepareSpecificationValidation(modifiedRequestObject, kuzzle);
      })
      .then(specifications => {
        var promises = [];
        specifications.forEach(specification => {
          var specLogName = specification._id.split('#').join(' / ');
          promises.push(internalEngine.createOrReplace('validations', specification._id, specification._source));
          kuzzle.pluginsManager.trigger('log:info', `Validation specification for ${specLogName} is about to be stored.`);
        });

        return Promise.all(promises);
      })
      .then(() => kuzzle.internalEngine.refresh())
      .then(() => kuzzle.validation.curateSpecification())
      .then(() => kuzzle.pluginsManager.trigger('data:afterUpdateSpecifications', new ResponseObject(modifiedRequestObject, modifiedRequestObject.data.body)));
  };

  /**
   * Add a specification collections
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteSpecifications = function adminDeleteSpecifications (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeDeleteSpecifications', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        if (kuzzle.validation.specification[modifiedRequestObject.index] === undefined || kuzzle.validation.specification[modifiedRequestObject.index][modifiedRequestObject.collection] === undefined) {
          // there was no specification for this collection
          return true;
        }
        return internalEngine.delete('validations', `${modifiedRequestObject.index}#${modifiedRequestObject.collection}`);
      })
      .then(() => {
        kuzzle.pluginsManager.trigger('log:info', `Validation specification for ${modifiedRequestObject.index}#${modifiedRequestObject.collection} has been deleted.`);

        return null;
      })
      .then(() => kuzzle.internalEngine.refresh())
      .then(() => kuzzle.validation.curateSpecification())
      .then(() => kuzzle.pluginsManager.trigger('data:afterDeleteSpecifications', new ResponseObject(modifiedRequestObject, {})));
  };

  /**
   * Validate a specification
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.validateSpecifications = function adminValidateSpecifications (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeValidateSpecifications', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        return prepareSpecificationValidation(modifiedRequestObject, kuzzle);
      })
      .then(response => {
        if (response.error) {
          return Promise.resolve(response.responseObject);
        }

        return Promise.resolve(modifiedRequestObject.data.body);
      })
      .then(response => {
        return kuzzle.pluginsManager.trigger('data:afterValidateSpecifications', new ResponseObject(modifiedRequestObject, response));
      });
  };

  /**
   * Returns the statistics frame from a date
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getStats = function adminGetStats (requestObject) {
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
  this.getLastStats = function adminGetLastStats (requestObject) {
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
  this.getAllStats = function adminGetAllStats (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetAllStats', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.statistics.getAllStats(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetAllStats', new ResponseObject(modifiedRequestObject, response)));
  };

  /**
   * Returns the Kuzzle configuration
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getConfig = function adminGetConfig (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetConfig', requestObject)
      .then(newRequestObject => {
        var
          pluginsConfig = {},
          promises = [];

        modifiedRequestObject = newRequestObject;

        Object.keys(kuzzle.pluginsManager.plugins).forEach(id => {
          promises.push(kuzzle.internalEngine.get('plugins', id));
        });

        return Promise
          .all(promises)
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
          });
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetConfig', new ResponseObject(modifiedRequestObject, response)));
  };

  /**
   * Reset a collection by removing all documents while keeping the existing mapping.
   *
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.truncateCollection = function adminTruncateCollection (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeTruncateCollection', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.truncateCollection(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterTruncateCollection', new ResponseObject(modifiedRequestObject, response)));
  };

  /**
   * Reset all indexes
   *
   * @param {RequestObject} requestObject
   * @param {Object} context
   * @returns {Promise}
   */
  this.deleteIndexes = function adminDeleteIndexes (requestObject, context) {
    var modifiedRequestObject = null;

    return engine.listIndexes()
      .then(res => {
        var
          allowedIndexes = [],
          indexes = res.indexes.filter(index => _.includes(requestObject.data.body.indexes, index));

        return kuzzle.repositories.user.load(context.token.userId)
          .then(user => {
            var promises = indexes.map(index => user.isActionAllowed({
              controller: 'admin',
              action: 'deleteIndex',
              index
            }, context, kuzzle)
              .then(isAllowed => {
                if (isAllowed) {
                  allowedIndexes.push(index);
                }
              }));

            return Promise.all(promises);
          })
          .then(() => {
            requestObject.data.body.indexes = allowedIndexes;
            return kuzzle.pluginsManager.trigger('data:beforeDeleteIndexes', requestObject);
          })
          .then(newRequestObject => {
            modifiedRequestObject = newRequestObject;
            return engine.deleteIndexes(modifiedRequestObject);
          })
          .then(response => {
            var responseObject = new ResponseObject(modifiedRequestObject, response);

            response.deleted.forEach(index => kuzzle.indexCache.remove(index));

            return kuzzle.pluginsManager.trigger('data:afterDeleteIndexes', responseObject);
          });
      });
  };

  /**
   * Create an empty index
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.createIndex = function adminCreateIndex (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeCreateIndex', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.createIndex(modifiedRequestObject);
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
  this.deleteIndex = function adminDeleteIndex (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeDeleteIndex', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.deleteIndex(modifiedRequestObject);
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
  this.removeRooms = function adminRemoveRooms (requestObject) {
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
   * @returns {Promise}
   */
  this.refreshIndex = function adminRefreshIndex (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeRefreshIndex', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.refreshIndex(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterRefreshIndex', new ResponseObject(modifiedRequestObject, response)));
  };

  /**
   * Gets the current autoRefresh value for the current index.
   *
   * @param {RequestObject} requestObject
   * @returns {Object}
   */
  this.getAutoRefresh = function adminGetAutoRefresh (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetAutoRefresh', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        return engine.getAutoRefresh(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetAutoRefresh', new ResponseObject(modifiedRequestObject, {response})))
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
   * @returns {Object}
   */

  this.setAutoRefresh = function adminSetAutoRefresh (requestObject) {
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

        return engine.setAutoRefresh(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterSetAutoRefresh', new ResponseObject(modifiedRequestObject, {response})))
      .then(response => {
        response.data.body = response.data.body.response;
        return response;
      });
  };

  this.createFirstAdmin = function adminCreateFirstAdmin (requestObject) {
    var
      modifiedRequestObject = null,
      reset = requestObject.data.body.reset || false;

    delete requestObject.data.body.reset;
    requestObject.data.body.profileIds = ['admin'];

    return kuzzle.pluginsManager.trigger('admin:beforeCreateFirstAdmin', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        return this.adminExists();
      })
      .then((adminExists) => {
        if (adminExists.data.body.exists) {
          return Promise.reject(new Error('admin user is already set'));
        }

        return kuzzle.funnel.controllers.security.createOrReplaceUser(modifiedRequestObject)
          .then((response) => {
            if (reset) {
              return resetRoles.call(kuzzle)
                .then(() => resetProfiles.call(kuzzle))
                .then(() => this.refreshIndex(new RequestObject({index: '%kuzzle'})))
                .then(() => kuzzle.pluginsManager.trigger('admin:afterCreateFirstAdmin', new ResponseObject(modifiedRequestObject, response)));
            }

            return kuzzle.pluginsManager.trigger('admin:afterCreateFirstAdmin', new ResponseObject(modifiedRequestObject, response));
          });
      });
  };

  this.adminExists = function adminExists (requestObject) {
    return kuzzle.pluginsManager.trigger('admin:beforeAdminExists', requestObject)
      .then(() => kuzzle.internalEngine.bootstrap.adminExists())
      .then((response) => kuzzle.pluginsManager.trigger('admin:afterAdminExists', new ResponseObject(requestObject, {exists: response})));
  };
}

function resetRoles () {
  var promises;

  promises = ['admin', 'default', 'anonymous'].map(id => {
    return this.internalEngine.createOrReplace('roles', id, this.config.security.standard.roles[id]);
  });

  return Promise.all(promises);
}

function resetProfiles () {
  return this.internalEngine
    .createOrReplace('profiles', 'admin', {policies: [{roleId: 'admin', allowInternalIndex: true}]})
    .then(() => this.internalEngine.createOrReplace('profiles', 'anonymous', {policies: [{roleId: 'anonymous'}]}))
    .then(() => this.internalEngine.createOrReplace('profiles', 'default', {policies: [{roleId: 'default'}]}));
}


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
