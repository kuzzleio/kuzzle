/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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
  errorsManager = require('../../config/error-codes/throw').wrap('api', 'collection'),
  BaseController = require('./baseController'),
  _ = require('lodash'),
  Bluebird = require('bluebird');

/**
 * @class CollectionController
 * @param {Kuzzle} kuzzle
 * @constructor
 */
class CollectionController extends BaseController {
  constructor(kuzzle) {
    super(kuzzle, [
      'create',
      'deleteSpecifications',
      'exists',
      'getMapping',
      'getSpecifications',
      'list',
      'scrollSpecifications',
      'searchSpecifications',
      'truncate',
      'updateMapping',
      'updateSpecifications',
      'validateSpecifications'
    ]);

    this.defaultScrollTTL = this.kuzzle.storageEngine.config.defaults.scrollTTL;
  }

  /**
   * Updates the mapping of the collection
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  updateMapping (request) {
    const
      { index, collection } = this.getIndexAndCollection(request),
      mapping = this.getObjectParam(request, 'body');

    this.assertIndexAndCollectionExists(index, collection);

    return this.storageEngine.updateMapping(index, collection, mapping)
      .then(({ dynamic, _meta, properties }) => ({ dynamic, _meta, properties }));
  }

  /**
   * Get the collection mapping
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  getMapping (request) {
    const
      { index, collection } = this.getIndexAndCollection(request),
      includeKuzzleMeta = this.tryGetBoolean(request, 'args.includeKuzzleMeta');

    this.assertIndexAndCollectionExists(index, collection);

    return this.storageEngine.getMapping(index, collection, { includeKuzzleMeta })
      .then(({ dynamic, _meta, properties }) => (
        {
          [index]: {
            mappings: {
              [collection]: {
                dynamic,
                _meta,
                properties
              }
            }
          }
        }));
  }

  /**
   * Get the collection validation specifications
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  getSpecifications (request) {
    const { index, collection } = this.getIndexAndCollection(request);

    this.assertIndexAndCollectionExists(index, collection);

    return this.kuzzle.internalIndex.get('validations', `${index}#${collection}`)
      .then(response => response._source)
      .catch(error => {
        if (error.status === 404) {
          error.message = `No specifications defined for index ${index} and collection ${collection}`;
        }

        throw error;
      });
  }

  /**
   * Search for collection validation specifications
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  searchSpecifications (request) {
    const { from, size, scroll, query } = this.getSearchParams(request);

    this.assertNotExceedMaxFetch(size, from);

    return this.kuzzle.internalIndex.search(
      'validations',
      query,
      { from, size, scroll }
    )
      .then(({ hits, scrollId, total }) => ({ hits, scrollId, total }));
  }

  /**
   * Scroll over a paginated search results
   *
   * @param {Request} request
   * @returns {Promise.<object>}
   */
  scrollSpecifications (request) {
    const
      scrollTTL = this.getNumberParam(request, 'args.scroll', this.defaultScrollTTL),
      scrollId = this.getStringParam(request, 'args.scrollId');

    return this.kuzzle.internalIndex.scroll('validations', scrollId, scrollTTL)
      .then(({ scrollId, hits, total }) => ({ scrollId, hits, total }));
  }

  /**
   * Replace the specifications of a collection
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  updateSpecifications (request) {
    const
      { index, collection } = this.getIndexAndCollection(request),
      specifications = this.getObjectParam(request, 'body');

    return this.kuzzle.validation.validateFormat(
      index,
      collection,
      specifications,
      true
    )
      .then(({ isValid, errors }) => {
        if (! isValid) {
          const error = errorsManager.getError('update_specifications');
          error.details = errors;

          throw error;
        }

        return this.kuzzle.internalIndex.createOrReplace(
          'validation',
          `${index}#${collection}`,
          specifications);
      })
      .then(() => this.kuzzle.internalIndex.refreshCollection('validations'))
      .then(() => this.kuzzle.validation.curateSpecification())
      .then(() => specifications);
  }

  /**
   * Add a specification collections
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  deleteSpecifications (request) {
    const
      { index, collection } = this.getIndexAndCollection(request),
      specificationsId = `${index}#${collection}`;

    return this.kuzzle.internalIndex.delete('validations', specificationsId)
      .then(() => this.kuzzle.internalIndex.refreshCollection('validations'))
      .then(() => this.kuzzle.validation.curateSpecification())
      .then(() => ({ acknowledged: true }));
  }

  /**
   * Validate a specification
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  validateSpecifications (request) {
    const specifications = this.getObjectParam(request, 'body');

    return this.kuzzle.validation.validateFormat(
      index,
      collection,
      specifications,
      true
    )
      .then(({ isValid, errors }) => {
        if (! isValid) {
          return {
            valid: false,
            details: errors,
            description: 'Some errors with provided specifications.'
          };
        }

        return { valid: true };
      });
  }

  /**
   * Reset a collection by removing all documents while keeping the existing mapping.
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  truncate(request) {
    assertHasIndexAndCollection(request);

    return this.storageEngine.truncateCollection(request)
      .then(() => ({ acknowledged: true }));
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  list(request) {
    const type = request.input.args.type || 'all';

    assertHasIndex(request);

    if (['all', 'stored', 'realtime'].indexOf(type) === -1) {
      errorsManager.throw('invalid_type_argument', type);
    }

    let collections = [];

    if (type === 'realtime' || type === 'all') {
      collections = this.kuzzle.hotelClerk.getRealtimeCollections(
        request.input.resource.index).map(name => ({ name, type: 'realtime' }));
    }

    return Bluebird.resolve()
      .then(() => {
        if (type === 'stored' || type === 'all') {
          return this.storageEngine.listCollections(request)
            .then(response => {
              for (const name of response.collections.stored) {
                collections.push({name, type: 'stored'});
              }
            });
        }

        return Bluebird.resolve();
      })
      .then(() => {
        collections.sort((a, b) => {
          if (a.name === b.name) {
            return 0;
          }
          return a.name < b.name ? -1 : 1;
        });

        return paginateCollections(request, {type, collections});
      });
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  exists(request) {
    assertHasIndexAndCollection(request);

    return this.storageEngine.collectionExists(request);
  }

  /**
   * Creates a new collection with the specifed mapping. Only update the mapping if collection exists.
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  create(request) {
    assertHasIndex(request);

    return this.storageEngine.createCollection(request)
      .then(response => {
        this.kuzzle.indexCache.add(
          request.input.resource.index,
          request.input.resource.collection);

        return response;
      });
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Array>}
   */
  _createSpecificationList (index, collection, specifications) {
    if (index && collection) {
      const specification = formatSpecification(
        index,
        collection,
        specifications);
      return Bluebird.resolve([ specification ]);
    }

    const specifications = [];

    _.forEach(specifications, (collections, _index) => {
      _.forEach(collections, (validation, _collection) => {
        specifications.push(formatSpecification(_index, _collection, validation));
      });
    });

    return Bluebird.resolve(specifications);
  }

}

module.exports = CollectionController;

/**
 * @param {string} request
 * @param {string} request
 * @param {object} validation
 * @returns {object}
 */
const formatSpecification = (index, collection, validation) => ({
  _id: `${index}#${collection}`,
  _source: {
    validation,
    index,
    collection
  }
});

/**
 * @param {Validation} validator - validator instance
 * @param list
 * @returns {Promise.<Boolean|Object>}
 */
function validateSpecificationList (validator, list) {
  return Bluebird.map(list, specification => validator.validateFormat(
    specification._source.index,
    specification._source.collection,
    specification._source.validation,
    true
  ))
    .then(response => {
      let errors = [];

      response
        .filter(value => !value.isValid)
        .forEach(value => {
          errors = errors.concat(value.errors);
        });

      if (errors.length === 0) {
        return {valid: true};
      }

      // we resolve here because we do not always need to send an
      // error each time this method is used
      return {
        valid: false,
        details: errors,
        description: 'Some errors with provided specifications.'
      };
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
    } else {
      response.from = 0;
    }

    if (request.input.args.size) {
      response.size = Number.parseInt(request.input.args.size);

      response.collections = response.collections.slice(
        response.from,
        response.from + response.size
      );
    } else {
      response.collections = response.collections.slice(response.from);
    }
  }

  return response;
}
