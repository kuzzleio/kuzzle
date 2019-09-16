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
      'validateSpecifications',
      'refresh'
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

    return this.publicStorage.updateMapping(index, collection, mapping)
      .then(({ dynamic, _meta, properties }) => ({
        dynamic,
        _meta,
        properties
      }));
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

    return this.publicStorage.getMapping(index, collection, { includeKuzzleMeta })
      .then(({ dynamic, _meta, properties }) => ({
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
    const { from, size, scrollTTL, searchBody } = this.getSearchParams(request);

    this.assertNotExceedMaxFetch(size - from);

    return this.kuzzle.internalIndex.search(
      'validations',
      searchBody,
      { from, size, scroll: scrollTTL }
    )
      .then(({ hits, scrollId, total }) => ({
        hits,
        scrollId,
        total
      }));
  }

  /**
   * Scroll over a paginated search results
   *
   * @param {Request} request
   * @returns {Promise.<object>}
   */
  scrollSpecifications (request) {
    const
      ttl = this.getStringParam(request, 'args.scroll', this.defaultScrollTTL),
      id = this.getStringParam(request, 'args.scrollId');

    return this.kuzzle.internalIndex.scroll(id, ttl)
      .then(({ scrollId, hits, total }) => ({
        scrollId,
        hits,
        total
      }));
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
          'validations',
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
      .catch(error => {
        if (error.status === 404) {
          return {
            acknowledged: true
          };
        }

        throw error;
      })
      .then(() => this.kuzzle.internalIndex.refreshCollection('validations'))
      .then(() => this.kuzzle.validation.curateSpecification())
      .then(() => ({
        acknowledged: true
      }));
  }

  /**
   * Validate a specification
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  validateSpecifications (request) {
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
          return {
            valid: false,
            details: errors,
            description: 'Some errors with provided specifications.'
          };
        }

        return {
          valid: true
        };
      });
  }

  /**
   * Reset a collection by removing all documents while keeping the existing mapping.
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  truncate (request) {
    const { index, collection } = this.getIndexAndCollection(request);

    return this.publicStorage.truncateCollection(index, collection)
      .then(() => ({
        acknowledged: true
      }));
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  list (request) {
    const
      index = this.getIndex(request),
      { from, size } = this.getSearchParams(request),
      type = this.getStringParam(request, 'args.type', 'all');

    if (['all', 'stored', 'realtime'].indexOf(type) === -1) {
      errorsManager.throw('invalid_type_argument', type);
    }

    let collections = [];

    if (type === 'realtime' || type === 'all') {
      collections = this.kuzzle.hotelClerk.getRealtimeCollections(index)
        .map(name => ({ name, type: 'realtime' }));
    }

    return Bluebird.resolve()
      .then(() => {
        if (type === 'realtime') {
          return;
        }

        return this.publicStorage.listCollections(index)
          .then(publicCollections => {
            for (const name of publicCollections) {
              collections.push({ name, type: 'stored' });
            }
          });
      })
      .then(() => {
        collections.sort((a, b) => {
          if (a.name === b.name) {
            return 0;
          }
          return a.name < b.name ? -1 : 1;
        });

        return this._paginateCollections(from, size, { type, collections });
      });
  }

  /**
   * @param {Request} request
   * @returns {Promise.<boolean>}
   */
  exists (request) {
    const { index, collection } = this.getIndexAndCollection(request);

    return this.publicStorage.collectionExists(index, collection)
      .then(exists => exists);
  }

  /**
   * Creates a new collection with the specifed mapping. Only update the mapping if collection exists.
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  create (request) {
    const
      mappings = this.getObjectParam(request, 'body', {}),
      { index, collection } = this.getIndexAndCollection(request);

    return this.publicStorage.createCollection(index, collection, mappings)
      .then(() => ({
        acknowledged: true
      }));
  }

  /**
   * Refresh a collection
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  refresh (request) {
    const { index, collection } = this.getIndexAndCollection(request);

    return this.publicStorage.refreshCollection(index, collection)
      .then(() => null);
  }


  /**
   * Uses from and size to paginate response results
   * If type is "all", stored collections are prioritary
   *
   * @param {Number} from
   * @param {Number} size
   * @param {Object} response
   * @returns {Object} { collections, from, size }
   */
  _paginateCollections (from, size, response) {
    if (from || size) {
      if (from) {
        response.from = Number.parseInt(from);
      } else {
        response.from = 0;
      }

      if (size) {
        response.size = Number.parseInt(size);

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
}

module.exports = CollectionController;
