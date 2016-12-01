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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeUpdateMapping', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return engine.updateMapping(modifiedData.requestObject);
      })
      .then(response => {
        kuzzle.indexCache.add(modifiedData.requestObject.index, modifiedData.requestObject.collection);
        return kuzzle.pluginsManager.trigger('data:afterUpdateMapping', {
          responseObject: new ResponseObject(modifiedData.requestObject, response),
          userContext: modifiedData.userContext
        });
      });
  };

  /**
   * Update the users collection mapping
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.updateUserMapping = function adminUpdateUserMapping (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeUpdateUserMapping', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.internalEngine.updateMapping('users', modifiedData.requestObject.data.body);
      })
      .then(response => {
        return kuzzle.pluginsManager.trigger('data:afterUpdateUserMapping', {
          responseObject: new ResponseObject(modifiedData.requestObject, response),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetMapping', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return engine.getMapping(modifiedData.requestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetMapping', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * Get the user mapping
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.getUserMapping = function adminGetUserMapping (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetUserMapping', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.internalEngine.getMapping({index: kuzzle.internalEngine.index, type: 'users'});
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetUserMapping', {
        responseObject: new ResponseObject(modifiedData.requestObject, {mapping: response[kuzzle.internalEngine.index].mappings.users.properties}),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * Get the collection validation specifications
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.getSpecifications = function adminGetSpecifications (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetSpecifications', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return internalEngine.get('validations', `${modifiedData.requestObject.index}#${modifiedData.requestObject.collection}`);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetSpecifications', {
        responseObject: new ResponseObject(modifiedData.requestObject, response._source),
        userContext: modifiedData.userContext
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
      size = 20,
      modifiedData = null;

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

    return kuzzle.pluginsManager.trigger('data:beforeSearchSpecifications', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return internalEngine.search('validations', query, from, size);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterSearchSpecifications', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * Add a specification collections
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.updateSpecifications = function adminUpdateSpecifications (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeUpdateSpecifications', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return prepareSpecificationValidation(modifiedData.requestObject, kuzzle);
      })
      .then(specifications => {
        var promises = [];

        specifications.forEach(specification => {
          var specLogName = specification._id.split('#').join(' / ');

          promises.push(internalEngine.createOrReplace('validations', specification._id, specification._source));
          kuzzle.pluginsManager.trigger('log:info', `Validation specification for ${specLogName} is about to be stored.`, userContext);
        });

        return Promise.all(promises);
      })
      .then(() => kuzzle.internalEngine.refresh())
      .then(() => kuzzle.validation.curateSpecification())
      .then(() => kuzzle.pluginsManager.trigger('data:afterUpdateSpecifications', {
        responseObject: new ResponseObject(modifiedData.requestObject, modifiedData.requestObject.data.body),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * Add a specification collections
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.deleteSpecifications = function adminDeleteSpecifications (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeDeleteSpecifications', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        if (kuzzle.validation.specification[modifiedData.requestObject.index] === undefined || kuzzle.validation.specification[modifiedData.requestObject.index][modifiedData.requestObject.collection] === undefined) {
          // there was no specification for this collection
          return true;
        }
        return internalEngine.delete('validations', `${modifiedData.requestObject.index}#${modifiedData.requestObject.collection}`);
      })
      .then(() => {
        kuzzle.pluginsManager.trigger('log:info', `Validation specification for ${modifiedData.requestObject.index}#${modifiedData.requestObject.collection} has been deleted.`, userContext);

        return null;
      })
      .then(() => kuzzle.internalEngine.refresh())
      .then(() => kuzzle.validation.curateSpecification())
      .then(() => kuzzle.pluginsManager.trigger('data:afterDeleteSpecifications', {
        responseObject: new ResponseObject(modifiedData.requestObject, {}),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * Validate a specification
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.validateSpecifications = function adminValidateSpecifications (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeValidateSpecifications', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return prepareSpecificationValidation(modifiedData.requestObject, kuzzle);
      })
      .then(response => {
        if (response.error) {
          return Promise.resolve(response.responseObject);
        }

        return Promise.resolve(modifiedData.requestObject.data.body);
      })
      .then(response => {
        return kuzzle.pluginsManager.trigger('data:afterValidateSpecifications', {
          responseObject: new ResponseObject(modifiedData.requestObject, response),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetStats', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.statistics.getStats(modifiedData.requestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetStats', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetLastStats', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.statistics.getLastStats();
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetLastStats', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetAllStats', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.statistics.getAllStats(modifiedData.requestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetAllStats', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
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
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetConfig', {requestObject, userContext})
      .then(data => {
        var
          pluginsConfig = {},
          promises = [];
        modifiedData = data;

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
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetConfig', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeTruncateCollection', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return engine.truncateCollection(modifiedData.requestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterTruncateCollection', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
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
      modifiedData = null;

    return engine.listIndexes()
      .then(res => {
        var
          allowedIndexes = [],
          indexes = res.indexes.filter(index => _.includes(requestObject.data.body.indexes, index));

        return kuzzle.repositories.user.load(userContext.token.userId)
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

            return kuzzle.pluginsManager.trigger('data:beforeDeleteIndexes', {requestObject, userContext});
          })
          .then(data => {
            modifiedData = data;

            return engine.deleteIndexes(modifiedData.requestObject);
          })
          .then(response => {
            var responseObject = new ResponseObject(modifiedData.requestObject, response);

            response.deleted.forEach(index => kuzzle.indexCache.remove(index));

            return kuzzle.pluginsManager.trigger('data:afterDeleteIndexes', {
              responseObject,
              userContext: modifiedData.userContext
            });
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeCreateIndex', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return engine.createIndex(modifiedData.requestObject);
      })
      .then(response => {
        kuzzle.indexCache.add(modifiedData.requestObject.index);

        return kuzzle.pluginsManager.trigger('data:afterCreateIndex', {
          responseObject: new ResponseObject(modifiedData.requestObject, response),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeDeleteIndex', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return engine.deleteIndex(modifiedData.requestObject);
      })
      .then(response => {
        kuzzle.indexCache.remove(modifiedData.requestObject.index);

        return kuzzle.pluginsManager.trigger('data:afterDeleteIndex', {
          responseObject: new ResponseObject(modifiedData.requestObject, response),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('subscription:beforeRemoveRooms', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.hotelClerk.removeRooms(modifiedData.requestObject);
      })
      .then(response => {
        var responseObject = new ResponseObject(modifiedData.requestObject, response);

        if (response.partialErrors && response.partialErrors.length > 0) {
          responseObject.error = new PartialError('Some errors with provided rooms', response.partialErrors);
          responseObject.status = responseObject.error.status;
        }

        return kuzzle.pluginsManager.trigger('subscription:afterRemoveRooms', {
          responseObject,
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeRefreshIndex', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return engine.refreshIndex(modifiedData.requestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterRefreshIndex', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeRefreshInternalIndex', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.internalEngine.refresh();
      })
      .then(() => kuzzle.pluginsManager.trigger('data:afterRefreshInternalIndex', {
        responseObject: new ResponseObject(modifiedData.requestObject, {acknowledged: true}),
        userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetAutoRefresh', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return engine.getAutoRefresh(modifiedData.requestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetAutoRefresh', {
        responseObject: new ResponseObject(modifiedData.requestObject, {response}),
        userContext: modifiedData.userContext
      }))
      .then(response => {
        response.responseObject.data.body = response.responseObject.data.body.response;

        return response;
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('data:beforeSetAutoRefresh', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        if (modifiedData.requestObject.data.body.autoRefresh === undefined) {
          throw new BadRequestError('mandatory parameter "autoRefresh" not found.');
        }
        if (typeof modifiedData.requestObject.data.body.autoRefresh !== 'boolean') {
          throw new BadRequestError('Invalid type for autoRefresh, expected Boolean got ' + typeof modifiedData.requestObject.data.body.autoRefresh);
        }

        return engine.setAutoRefresh(modifiedData.requestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterSetAutoRefresh', {
        responseObject: new ResponseObject(modifiedData.requestObject, {response}),
        userContext: modifiedData.userContext
      }))
      .then(response => {
        response.responseObject.data.body = response.responseObject.data.body.response;

        return response;
      });
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Object}
   */
  this.createFirstAdmin = function adminCreateFirstAdmin (requestObject, userContext) {
    var
      modifiedData = null,
      reset = requestObject.data.body.reset || false;

    delete requestObject.data.body.reset;
    requestObject.data.body.profileIds = ['admin'];

    return kuzzle.pluginsManager.trigger('admin:beforeCreateFirstAdmin', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return this.adminExists(requestObject, userContext);
      })
      .then((adminExists) => {
        if (adminExists.responseObject.data.body.exists) {
          return Promise.reject(new Error('admin user is already set'));
        }

        return kuzzle.funnel.controllers.security.createOrReplaceUser(modifiedData.requestObject, modifiedData.userContext)
          .then((response) => {
            if (reset) {
              return resetRoles.call(kuzzle)
                .then(() => resetProfiles.call(kuzzle))
                .then(() => this.refreshIndex(new RequestObject({index: '%kuzzle'})))
                .then(() => kuzzle.pluginsManager.trigger('admin:afterCreateFirstAdmin', {
                  responseObject: new ResponseObject(modifiedData.requestObject, response),
                  userContext: modifiedData.userContext
                }));
            }

            return kuzzle.pluginsManager.trigger('admin:afterCreateFirstAdmin', {
              responseObject: new ResponseObject(modifiedData.requestObject, response),
              userContext: modifiedData.userContext
            });
          });
      });
  };

  /**
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Object}
   */
  this.adminExists = function adminExists (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('admin:beforeAdminExists', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.internalEngine.bootstrap.adminExists();
      })
      .then((response) => kuzzle.pluginsManager.trigger('admin:afterAdminExists', {
        responseObject: new ResponseObject(modifiedData.requestObject, {exists: response}),
        userContext: modifiedData.userContext
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
