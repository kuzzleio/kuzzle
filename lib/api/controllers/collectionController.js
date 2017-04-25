/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  _ = require('lodash'),
  Bluebird = require('bluebird'),
  {BadRequestError, SizeLimitError} = require('kuzzle-common-objects').errors,
  {assertHasBody, assertHasIndex, assertHasIndexAndCollection} = require('./util/requestAssertions');

/**
 * @class CollectionController
 * @param {Kuzzle} kuzzle
 * @constructor
 */
class CollectionController {
  constructor(kuzzle) {
    /** @type Kuzzle */
    this.kuzzle = kuzzle;
    /** @type ElasticSearch */
    this.engine = kuzzle.services.list.storageEngine;
    /** @type InternalEngine */
    this.internalEngine = kuzzle.internalEngine;
  }

  /**
   * Add a mapping to the collection
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  updateMapping(request) {
    assertHasBody(request);
    return this.engine.updateMapping(request)
      .then(response => {
        this.kuzzle.indexCache.add(request.input.resource.index, request.input.resource.collection);

        return Bluebird.resolve(response);
      });
  }

  /**
   * Get the collection mapping
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  getMapping(request) {
    assertHasIndexAndCollection(request);

    return this.engine.getMapping(request);
  }

  /**
   * Get the collection validation specifications
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  getSpecifications(request) {
    assertHasIndexAndCollection(request);

    return this.internalEngine.get('validations', `${request.input.resource.index}#${request.input.resource.collection}`)
      .then(response => Bluebird.resolve(response._source));
  }

  /**
   * Search for collection validation specifications
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  searchSpecifications(request) {
    const
      query = request.input.body && request.input.body.query ? request.input.body.query : {};

    if (request.input.args.size) {
      const size = request.input.args.size - (request.input.args.from || 0);

      if (size > this.kuzzle.config.limits.documentsFetchCount) {
        throw new SizeLimitError(`Search page size exceeds server configured documents limit (${this.kuzzle.config.limits.documentsFetchCount})`);
      }
    }

    return this.internalEngine.search('validations', query, request.input.args);
  }

  /**
   * Scroll over a paginated search results
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  scrollSpecifications(request) {
    if (!request.input.args.scrollId) {
      throw new BadRequestError('Missing "scrollId" argument');
    }

    return this.internalEngine.scroll('validations', request.input.args.scrollId, request.input.args.scroll);
  }

  /**
   * Add a specification collections
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  updateSpecifications(request) {
    let specifications = [];

    assertHasBody(request);

    return createSpecificationList(request)
      .then(list => {
        specifications = list;
        return validateSpecificationList(this.kuzzle.validation, list);
      })
      .then(response => {
        if (response.valid) {
          const promises = [];

          specifications.forEach(specification => {
            const specLogName = specification._id.split('#').join(' / ');
            promises.push(this.internalEngine.createOrReplace('validations', specification._id, specification._source));
            this.kuzzle.pluginsManager.trigger('log:info', `Validation specification for ${specLogName} is about to be stored.`);
          });

          return Bluebird.all(promises);
        }

        this.kuzzle.pluginsManager.trigger('validation:error', response.description);

        const error = new BadRequestError(response.description);
        error.details = response.details;
        throw error;
      })
      .then(() => this.kuzzle.internalEngine.refresh())
      .then(() => this.kuzzle.validation.curateSpecification())
      .then(() => Bluebird.resolve(request.input.body));
  }

  /**
   * Add a specification collections
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  deleteSpecifications(request) {
    assertHasIndexAndCollection(request);

    if (
      this.kuzzle.validation.specification[request.input.resource.index] === undefined ||
      this.kuzzle.validation.specification[request.input.resource.index][request.input.resource.collection] === undefined
    ) {
      return Bluebird.resolve({});
    }

    return this.internalEngine.delete('validations', `${request.input.resource.index}#${request.input.resource.collection}`)
      .then(() => {
        this.kuzzle.pluginsManager.trigger('log:info', `Validation specification for ${request.input.resource.index}#${request.input.resource.collection} has been deleted.`);

        return Bluebird.resolve();
      })
      .then(() => this.kuzzle.internalEngine.refresh())
      .then(() => this.kuzzle.validation.curateSpecification())
      .then(() => Bluebird.resolve({}));
  }

  /**
   * Validate a specification
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  validateSpecifications(request) {
    assertHasBody(request);

    return createSpecificationList(request)
      .then(list => validateSpecificationList(this.kuzzle.validation, list));
  }

  /**
   * Reset a collection by removing all documents while keeping the existing mapping.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  truncate(request) {
    assertHasIndexAndCollection(request);

    return this.engine.truncateCollection(request);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  list(request) {
    const
      type = request.input.args.type ? request.input.args.type : 'all';

    assertHasIndex(request);

    if (['all', 'stored', 'realtime'].indexOf(type) === -1) {
      throw new BadRequestError(`collection:listCollections must specify a valid type argument; Expected: "all", "stored" or "realtime"; Received: "${type}".`);
    }

    if (type === 'stored') {
      return this.engine.listCollections(request)
        .then(response => {
          response.type = type;
          response.collections = formatCollections(response);
          return Bluebird.resolve(response);
        });
    }

    const realtimeCollections = this.kuzzle.hotelClerk.getRealtimeCollections()
      .filter(collection => collection.index === request.input.resource.index)
      .map(collection => collection.name);

    if (type === 'realtime') {
      const realtimeResponse = {type, collections: {realtime: realtimeCollections}};

      realtimeResponse.collections = formatCollections(realtimeResponse);

      return Bluebird.resolve(realtimeResponse);
    }

    return this.engine.listCollections(request)
      .then(response => {
        response.type = type;
        response.collections.realtime = realtimeCollections;
        response.collections = formatCollections(response);

        return Bluebird.resolve(paginateCollections(request, response));
      });
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  exists(request) {
    assertHasIndexAndCollection(request);

    return this.engine.collectionExists(request);
  }

  /**
   * Creates a new collection. Does nothing if the collection already exists.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  create(request) {
    assertHasIndex(request);

    return this.engine.createCollection(request)
      .then(response => {
        this.kuzzle.indexCache.add(request.input.resource.index, request.input.resource.collection);

        return Bluebird.resolve(response);
      });
  }
}

module.exports = CollectionController;

/**
 * @param {Request} request
 * @returns {Promise<Array>}
 */
function createSpecificationList (request) {
  const specifications = [];

  _.forEach(request.input.body, (collections, index) => {
    _.forEach(collections, (validation, collection) => {
      specifications.push({
        _id: `${index}#${collection}`,
        _source: {validation, index, collection}
      });
    });
  });

  return Bluebird.resolve(specifications);
}

/**
 * @param {Validation} validator - validator instance
 * @param list
 * @returns {Promise<Boolean|Object>}
 */
function validateSpecificationList (validator, list) {
  const promises = [];

  list.forEach(specification => {
    promises.push(validator.isValidSpecification(specification._source.index, specification._source.collection, specification._source.validation, true));
  });

  return Bluebird.all(promises)
    .then(response => {
      if (_.every(response, 'isValid')) {
        return Bluebird.resolve({valid: true});
      }

      let errors = [];

      response.forEach(value => {
        if (!value.isValid) {
          errors = Array.prototype.concat.apply(errors, value.errors);
        }
      });

      // we resolve here because we do not always need to send an error each time this method is used
      return Bluebird.resolve({valid: false, details: errors, description: 'Some errors with provided specifications.'});
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
  const collections = [];

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
    if (a.name === b.name) {
      return 0;
    }

    return a.name < b.name ? -1 : 1;
  });
}
