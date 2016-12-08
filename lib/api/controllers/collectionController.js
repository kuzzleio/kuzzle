'use strict';

var
  _ = require('lodash'),
  Promise = require('bluebird'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  assertHasBody = require('./util/requestAssertions').assertHasBody,
  assertHasIndex = require('./util/requestAssertions').assertHasIndex,
  assertHasIndexAndCollection = require('./util/requestAssertions').assertHasIndexAndCollection;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function CollectionController (kuzzle) {
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
  this.updateMapping = function collectionUpdateMapping (request) {
    return engine.updateMapping(request)
      .then(response => {
        kuzzle.indexCache.add(request.input.resource.index, request.input.resource.collection);

        return Promise.resolve(response);
      });
  };

  /**
   * Update the users collection mapping

   * @param {Request} request
   * @returns {Promise}
   */
  this.updateUserMapping = function collectionUpdateUserMapping (request) {
    return kuzzle.internalEngine.updateMapping('users', request.input.body);
  };

  /**
   * Get the collection mapping
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.getMapping = function collectionGetMapping (request) {
    assertHasIndexAndCollection(request, 'collection:getMapping');
    return engine.getMapping(request);
  };

  /**
   * Get the user mapping
   *
   * @returns {Promise}
   */
  this.getUserMapping = function collectionGetUserMapping () {
    return kuzzle.internalEngine.getMapping({index: kuzzle.internalEngine.index, type: 'users'})
      .then(response => ({mapping: response[kuzzle.internalEngine.index].mappings.users.properties}));
  };

  /**
   * Get the collection validation specifications
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.getSpecifications = function collectionGetSpecifications (request) {
    return internalEngine.get('validations', `${request.input.resource.index}#${request.input.resource.collection}`)
      .then(response => Promise.resolve(response._source));
  };

  /**
   * Search for collection validation specifications
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.searchSpecifications = function collectionSearchSpecifications (request) {
    var
      query = request.input.body && request.input.body.query ? request.input.body.query : {},
      from = request.input.args.from || 0,
      size = request.input.args.size || 20;

    return internalEngine.search('validations', query, from, size);
  };

  /**
   * Add a specification collections
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.updateSpecifications = function collectionUpdateSpecifications (request) {
    assertHasBody(request, 'collection:updateSpecifications');

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
  this.deleteSpecifications = function collectionDeleteSpecifications (request) {
    assertHasIndexAndCollection(request, 'collection:deleteSpecifications');

    if (
      kuzzle.validation.specification[request.input.resource.index] === undefined ||
      kuzzle.validation.specification[request.input.resource.index][request.input.resource.collection] === undefined
    ) {
      return Promise.resolve({});
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
  this.validateSpecifications = function collectionValidateSpecifications (request) {
    assertHasBody(request, 'collection:validateSpecifications');

    return prepareSpecificationValidation(request, kuzzle)
      .then(() => {
        return Promise.resolve({valid: true});
      })
      .catch(error => {
        request.setResult({
          valid: false,
          errors: error.details
        });
        return Promise.reject(error);
      });
  };

  /**
   * Reset a collection by removing all documents while keeping the existing mapping.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.truncate = function collectionTruncate (request) {
    assertHasIndexAndCollection(request, 'collection:truncate');

    return engine.truncateCollection(request);
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.list = function collectionList (request) {
    var
      type = request.input.args.type ? request.input.args.type : 'all',
      realtimeCollections = [];

    assertHasIndex(request, 'collection:list');

    if (['all', 'stored', 'realtime'].indexOf(type) === -1) {
      throw new BadRequestError(`listCollections: unrecognized type argument: "${type}"`);
    }

    if (type === 'stored') {
      return engine.listCollections(request)
        .then(response => {
          response.type = type;
          response.collections = formatCollections(response);
          return Promise.resolve(response);
        });
    }

    realtimeCollections = kuzzle.hotelClerk.getRealtimeCollections()
      .filter(collection => collection.index === request.input.resource.index)
      .map(collection => collection.name);

    if (type === 'realtime') {
      let realtimeResponse = {type, collections: {realtime: realtimeCollections}};

      realtimeResponse.collections = formatCollections(realtimeResponse);

      return Promise.resolve(realtimeResponse);
    }

    return engine.listCollections(request)
      .then(response => {
        response.type = type;
        response.collections.realtime = realtimeCollections;
        response.collections = formatCollections(response);
        response = paginateCollections(request, response);

        return Promise.resolve(response);
      });
  };

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.collectionExists = function collectionCollectionExists (request) {
    assertHasIndexAndCollection(request, 'collection:exist');

    return engine.collectionExists(request);
  };

  /**
   * Creates a new collection. Does nothing if the collection already exists.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.create = function collectionCreate (request) {
    assertHasIndex(request, 'collection:create');

    return engine.createCollection(request)
      .then(response => {
        kuzzle.indexCache.add(request.input.resource.index, request.input.resource.collection);

        return Promise.resolve(response);
      });
  };
}

module.exports = CollectionController;

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
      var error;

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


/**
 * Uses from and size to paginate response results
 * If type is "all", stored collections are prioritary
 *
 * @param {Request} request
 * @param {object} response
 * @returns {object}
 */
function paginateCollections (request, response) {
  if (request.input.args.from || request.input.args.size) {
    if (request.input.args.from) {
      response.from = Number.parseInt(request.input.args.from);
    }
    else {
      response.from = 0;
    }

    if (request.input.args.size) {
      response.size = Number.parseInt(request.input.args.size);

      response.collections = response.collections.slice(response.from, response.from + response.size);
    }
    else {
      response.collections = response.collections.slice(response.from);
    }
  }

  return response;
}

/**
 * @param {object} response
 * @returns {Array.<{name: string, type: string}>}
 */
function formatCollections (response) {
  var collections = [];

  if (response.collections.realtime) {
    response.collections.realtime.forEach(item => {
      collections.push({name: item, type: 'realtime'});
    });
  }

  if (response.collections.stored) {
    response.collections.stored.forEach(item => {
      collections.push({name: item, type: 'stored'});
    });
  }

  return collections.sort((a, b) => {
    if (a.name > b.name) {
      return 1;
    }
    else if (a.name < b.name) {
      return -1;
    }

    return 0;
  });
}
