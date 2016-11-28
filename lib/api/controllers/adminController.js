var
  _ = require('lodash'),
  Promise = require('bluebird'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  PartialError = require('kuzzle-common-objects').errors.PartialError,
  Request = require('kuzzle-common-objects').Request;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function AdminController(kuzzle) {
  var
    /** @type ElasticSearch */
    engine = kuzzle.services.list.storageEngine,
    /** @type InternalEngine */
    internalEngine = kuzzle.internalEngine;

  /**
   * Add a mapping to the collection
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.updateMapping = function adminUpdateMapping (request) {
    return engine.updateMapping(request)
      .then(response => {
        kuzzle.indexCache.add(request.input.resource.index, request.input.resource.collection);

        return Promise.resolve(response);
      });
  };

  /**
   * Get the collection mapping
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.getMapping = function adminGetMapping (request) {
    return engine.getMapping(request);
  };

  /**
   * Get the collection validation specifications
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.getSpecifications = function adminGetSpecifications (request) {
    return internalEngine.get('validations', `${request.input.resource.index}#${request.input.resource.collection}`)
      .then(response => Promise.resolve(response._source));
  };

  /**
   * Search for collection validation specifications
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.searchSpecifications = function adminSearchSpecifications (request) {
    var
      query = {},
      from = 0,
      size = 20;

    if (request.input.body.query) {
      query = request.input.body.query;
    }
    if (request.input.args.from) {
      from = request.input.args.from;
    }
    if (request.input.args.size) {
      size = request.input.args.size;
    }

    return internalEngine.search('validations', query, from, size);
  };

  /**
   * Add a specification collections
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.updateSpecifications = function adminUpdateSpecifications (request) {
    return prepareSpecificationValidation(request, kuzzle)
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
      .then(() => Promise.resolve(request.input.body));
  };

  /**
   * Add a specification collections
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.deleteSpecifications = function adminDeleteSpecifications (request) {
    if (
      kuzzle.validation.specification[request.input.resource.index] === undefined ||
      kuzzle.validation.specification[request.input.resource.index][request.input.resource.collection] === undefined
    ) {
      // There was no specification for this collection
      return Promise.resolve(true);
    }

    return internalEngine.delete('validations', `${request.input.resource.index}#${request.input.resource.collection}`)
      .then(() => {
        kuzzle.pluginsManager.trigger('log:info', `Validation specification for ${request.input.resource.index}#${request.input.resource.collection} has been deleted.`);

        return Promise.resolve();
      })
      .then(() => kuzzle.internalEngine.refresh())
      .then(() => kuzzle.validation.curateSpecification())
      .then(() => Promise.resolve({}));
  };

  /**
   * Validate a specification
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.validateSpecifications = function adminValidateSpecifications (request) {
    return prepareSpecificationValidation(request, kuzzle)
      .then(() => {
        return Promise.resolve(request.input.body);
      });
  };

  /**
   * Returns the statistics frame from a date
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.getStats = function adminGetStats (request) {
    return kuzzle.statistics.getStats(request);
  };

  /**
   * Returns the last statistics frame
   *
   * @returns {Promise<Object>}
   */
  this.getLastStats = function adminGetLastStats () {
    return kuzzle.statistics.getLastStats();
  };

  /**
   * Returns all stored statistics frames
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.getAllStats = function adminGetAllStats (request) {
    return kuzzle.statistics.getAllStats(request);
  };

  /**
   * Returns the Kuzzle configuration
   *
   * @returns {Promise<Object>}
   */
  this.getConfig = function adminGetConfig () {
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
      });
  };

  /**
   * Reset a collection by removing all documents while keeping the existing mapping.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.truncateCollection = function adminTruncateCollection (request) {
    return engine.truncateCollection(request);
  };

  /**
   * Reset all indexes
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.deleteIndexes = function adminDeleteIndexes (request) {
    var
      allowedIndexes = [],
      indexes;

    return engine.listIndexes()
      .then(res => {
        indexes = res.indexes.filter(index => _.includes(request.input.body.indexes, index));

        return kuzzle.repositories.user.load(request.context.user._id);
      })
      .then(user => {
        var promises = indexes.map(index => user.isActionAllowed(new Request({controller: 'admin', action: 'deleteIndex', index}, request.context), kuzzle)
          .then(isAllowed => {
            if (isAllowed) {
              allowedIndexes.push(index);
            }
          }));

        return Promise.all(promises);
      })
      .then(() => {
        request.input.body.indexes = allowedIndexes;

        return Promise.resolve();
      })
      .then(() => {
        return engine.deleteIndexes(request);
      })
      .then(response => {
        response.deleted.forEach(index => kuzzle.indexCache.remove(index));

        return Promise.resolve(response);
      });
  };

  /**
   * Create an empty index
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createIndex = function adminCreateIndex (request) {
    return engine.createIndex(request)
      .then(response => {
        kuzzle.indexCache.add(request.input.resource.index);

        return Promise.resolve(response);
      });
  };

  /**
   * Delete the entire index and associated collections
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.deleteIndex = function adminDeleteIndex (request) {
    return engine.deleteIndex(request)
      .then(response => {
        kuzzle.indexCache.remove(request.input.resource.index);

        return Promise.resolve(response);
      });
  };

  /**
   * Remove all rooms for a given collection
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.removeRooms = function adminRemoveRooms (request) {
    return kuzzle.hotelClerk.removeRooms(request)
      .then(response => {
        if (response.partialErrors && response.partialErrors.length > 0) {
          request.setError(new PartialError('Some errors with provided rooms', response.partialErrors));
        }

        return Promise.resolve(response);
      });
  };

  /**
   * Forces the refresh of the given index.
   * /!\ Can lead to some performances issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.refreshIndex = function adminRefreshIndex (request) {
    return engine.refreshIndex(request);
  };

  /**
   * Forces the refresh of the internal index.
   * /!\ Can lead to some performances issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html
   *
   * @returns {Promise<Object>}
   */
  this.refreshInternalIndex = function adminRefreshInternalIndex () {
    return kuzzle.internalEngine.refresh()
      .then(() => Promise.resolve({acknowledged: true}));
  };

  /**
   * Gets the current autoRefresh value for the current index.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.getAutoRefresh = function adminGetAutoRefresh (request) {
    return engine.getAutoRefresh(request);
  };

  /**
   * Sets elasticsearch autorefresh on/off for current index.
   * /!\ Can lead to some performances issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.setAutoRefresh = function adminSetAutoRefresh (request) {
    if (typeof request.input.body.autoRefresh === 'undefined') {
      throw new BadRequestError('mandatory parameter "autoRefresh" not found.');
    }
    if (typeof request.input.body.autoRefresh !== 'boolean') {
      throw new BadRequestError('Invalid type for autoRefresh, expected Boolean got ' + typeof request.input.body.autoRefresh);
    }

    return engine.setAutoRefresh(request)
      .then(response => {
        return Promise.resolve({response});
      });
  };

  /**
   * Creates the first admin user if it does not already exist
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createFirstAdmin = function adminCreateFirstAdmin (request) {
    var reset = request.input.body.reset || false;

    return this.adminExists()
      .then(adminExists => {

        delete request.input.body.reset;
        request.input.body.profileIds = ['admin'];

        if (adminExists.exists) {
          return Promise.reject(new Error('admin user is already set'));
        }

        return kuzzle.funnel.controllers.security.createOrReplaceUser(request);
      })
      .then(response => {
        if (reset) {
          return resetRoles.call(kuzzle)
            .then(() => resetProfiles.call(kuzzle))
            .then(() => this.refreshInternalIndex())
            .then(() => Promise.resolve(response));
        }

        return Promise.resolve(response);
      });
  };

  /**
   * Checks if an admin user Exists
   *
   * @returns {Promise<Object>}
   */
  this.adminExists = function adminExists () {
    return kuzzle.internalEngine.bootstrap.adminExists()
      .then((response) => Promise.resolve({exists: response}));
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
 * @param {Request} request
 * @param {Kuzzle} kuzzle
 * @returns {Promise}
 */
function prepareSpecificationValidation(request, kuzzle) {
  var specifications = [];

  return createSpecificationList(request)
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
 * @param {Request} request
 * @returns {Promise<Array>}
 */
function createSpecificationList (request) {
  var specifications = [];

  _.forEach(request.input.body, (collections, index) => {
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
 * @returns {Promise<Boolean|Object>}
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
