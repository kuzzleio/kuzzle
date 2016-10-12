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
  this.updateMapping = requestObject => {
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
  this.getMapping = requestObject => {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetMapping', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return engine.getMapping(modifiedRequestObject);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetMapping', new ResponseObject(modifiedRequestObject, response)));
  };

  /**
   * Add a specification collections
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.updateSpecifications = requestObject => {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeUpdateSpecifications', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        return prepareSpecificationValidation(modifiedRequestObject, kuzzle);
      })
      .then(response => {
        var promises = [];

        if (response.error) {
          return Promise.resolve(response.responseObject);
        }
        _.forEach(response.specifications, specification => {
          promises.push(internalEngine.createOrReplace('validation', specification.specName, specification.specifications));
        });

        return Promise.all(promises)
          .then(() => {
            return Promise.resolve(modifiedRequestObject.data.body);
          });
      })
      .then(response => {
        return kuzzle.pluginsManager.trigger('data:afterUpdateSpecifications', new ResponseObject(modifiedRequestObject, response));
      });
  };

  /**
   * Validate a specification
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.validateSpecifications = requestObject => {
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
  this.getStats = requestObject => {
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
  this.getLastStats = requestObject => {
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
  this.getAllStats = requestObject => {
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
  this.getConfig = requestObject => {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('data:beforeGetConfig', requestObject)
      .then(newRequestObject => {
        var
          pluginsConfig = {},
          response;

        modifiedRequestObject = newRequestObject;

        _.forEach(kuzzle.pluginsManager.plugins, (object, id) => {
          pluginsConfig[id] = _.assignIn({}, object);
          if(pluginsConfig[id].object.context && pluginsConfig[id].object.context.config) {
            // remove the kuzzle configuration which can be included into plugin context
            delete pluginsConfig[id].object.context.config;
          }
        });

        response = {
          kuzzle: _.assignIn({}, kuzzle.config),
          plugins: {
            config: pluginsConfig,
            routes: _.assignIn([], kuzzle.pluginsManager.routes)
          }
        };

        return Promise.resolve(response);
      })
      .then(response => kuzzle.pluginsManager.trigger('data:afterGetConfig', new ResponseObject(modifiedRequestObject, response)));
  };

  /**
   * Reset a collection by removing all documents while keeping the existing mapping.
   *
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.truncateCollection = requestObject => {
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
  this.deleteIndexes = (requestObject, context) => {
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
  this.createIndex = requestObject => {
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
  this.deleteIndex = requestObject => {
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
  this.removeRooms = requestObject => {
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
  this.refreshIndex = requestObject => {
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
  this.getAutoRefresh = requestObject => {
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
  this.setAutoRefresh = requestObject => {
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

  this.createFirstAdmin = requestObject => {
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

  this.adminExists = requestObject => {
    return kuzzle.pluginsManager.trigger('admin:beforeAdminExists', requestObject)
      .then(() => kuzzle.internalEngine.search('users', {query: {in: {profileIds: ['admin']}}}))
      .then((response) => kuzzle.pluginsManager.trigger('admin:afterAdminExists', new ResponseObject(requestObject, {exists: response.hits.length > 0})));
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
      var responseObject;

      if (response === true) {
        return Promise.resolve({error: false, specifications: specifications});
      }

      responseObject = new ResponseObject(requestObject, response);
      responseObject.error = 'Some errors with provided specifications.';
      responseObject.status = 400;
      return Promise.resolve({error: true, responseObject: responseObject});
    });
}

function createSpecificationList (requestObject) {
  var specifications = [];

  _.forEach(requestObject.data.body, (collections, indexName) => {
    _.forEach(collections, (_specifications, collectionName) => {
      specifications.push({
        specName: `${indexName}#${collectionName}`,
        specifications: _specifications,
        indexName: indexName,
        collectionName: collectionName
      });
    });
  });

  return Promise.resolve(specifications);
}

function validateSpecificationList (kuzzle, list) {
  var
    promises = [],
    errors = [];

  _.forEach(list, specification => {
    promises.push(kuzzle.validation.validateSpecification(specification.indexName, specification.collectionName, specification.specifications));
  });

  return Promise.all(promises)
    .then(response => {
      if (_.every(response, 'isValid')) {
        return Promise.resolve(true);
      }
      _.forEach(response, value => {
        if (!value.isValid) {
          errors.push(value.error);
        }
      });
      return Promise.resolve(Array.prototype.concat.apply([], errors)); // flatten the array
    });
}

module.exports = AdminController;
