/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

const kerror = require('../../kerror');
const { isPlainObject } = require('../../util/safeObject');
const { NativeController } = require('./base');

/**
 * @class CollectionController
 * @param {Kuzzle} kuzzle
 * @constructor
 */
class CollectionController extends NativeController {
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
      'update',
      'updateMapping',
      'updateSpecifications',
      'validateSpecifications',
      'refresh',
      'delete'
    ]);

    this.defaultScrollTTL = this.kuzzle.storageEngine.config.defaults.scrollTTL;
  }

  /**
   * Updates the mapping of the collection
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async updateMapping (request) {
    const
      { index, collection } = this.getIndexAndCollection(request),
      mapping = this.getBody(request);

    const updated = await this.publicStorage.updateMapping(
      index,
      collection,
      mapping);

    return this._filterMappingResponse(updated);
  }

  /**
   * Get the collection mapping
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async getMapping (request) {
    const
      { index, collection } = this.getIndexAndCollection(request),
      includeKuzzleMeta = this.getBoolean(request, 'includeKuzzleMeta');

    const mapping = await this.publicStorage.getMapping(
      index,
      collection,
      { includeKuzzleMeta });

    return this._filterMappingResponse(mapping);
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
          throw kerror.getFrom(
            error,
            'validation',
            'assert',
            'not_found',
            index,
            collection);
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

    if (!isPlainObject(searchBody)) {
      throw kerror.get(
        'api',
        'assert',
        'invalid_type',
        'body.query',
        'object');
    }

    this.assertNotExceedMaxFetch(size - from);

    return this.kuzzle.internalIndex.search(
      'validations',
      searchBody,
      { from, scroll: scrollTTL, size }
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
      ttl = this.getString(request, 'scroll', this.defaultScrollTTL),
      id = this.getString(request, 'scrollId');

    return this.kuzzle.internalIndex.scroll(id, ttl)
      .then(({ scrollId, hits, total }) => ({
        hits,
        scrollId,
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
      specifications = this.getBody(request);

    return this.kuzzle.validation.validateFormat(
      index,
      collection,
      specifications,
      true
    )
      .then(({ isValid, errors }) => {
        if (! isValid) {
          throw kerror.get(
            'validation',
            'assert',
            'invalid_specifications',
            errors.join('\n\t- '));
        }

        return this.kuzzle.internalIndex.createOrReplace(
          'validations',
          `${index}#${collection}`,
          {
            collection,
            index,
            validation: specifications
          });
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
      specifications = this.getBody(request);

    return this.kuzzle.validation.validateFormat(
      index,
      collection,
      specifications,
      true
    )
      .then(({ isValid, errors }) => {
        if (! isValid) {
          return {
            description: 'Some errors with provided specifications.',
            details: errors,
            valid: false
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
  async list (request) {
    const index = this.getIndex(request);
    const from = this.getInteger(request, 'from', 0);
    const size = this.getInteger(request, 'size', 0);
    const type = this.getString(request, 'type', 'all');

    if (['all', 'stored', 'realtime'].indexOf(type) === -1) {
      throw kerror.get('api', 'assert', 'invalid_argument', '"all", "stored", "realtime"');
    }

    let collections = [];

    if (type === 'realtime' || type === 'all') {
      collections = this.kuzzle.hotelClerk.getRealtimeCollections(index)
        .map(name => ({ name, type: 'realtime' }));
    }

    if (type !== 'realtime') {
      const publicCollections = await this.publicStorage.listCollections(index);

      collections = collections.concat(
        publicCollections.map(name => ({ name, type: 'stored' })));
    }

    collections.sort((a, b) => {
      if (a.name === b.name) {
        return 0;
      }
      return a.name < b.name ? -1 : 1;
    });

    return this._paginateCollections(from, size, { collections, type });
  }

  /**
   * @param {Request} request
   * @returns {Promise.<boolean>}
   */
  exists (request) {
    const { index, collection } = this.getIndexAndCollection(request);

    return this.publicStorage.collectionExists(index, collection);
  }

  /**
   * Creates a new collection with the specifed mappings and settings.
   * Only update the mappings and settings if the collection exists.
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async create (request) {
    const
      body = this.getBody(request, {}),
      { index, collection } = this.getIndexAndCollection(request);

    let config = {};

    // @deprecated sending directly the mappings is deprecated since 2.1.0
    if (body.properties || body.dynamic || body._meta) {
      config.mappings = body;
    }
    else {
      config = body;
    }

    await this.publicStorage.createCollection(index, collection, config);

    return { acknowledged: true };
  }

  /**
   * Updates a collection mappings and settings.
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async update (request) {
    const
      config = this.getBody(request, {}),
      { index, collection } = this.getIndexAndCollection(request);

    await this.publicStorage.updateCollection(index, collection, config);

    return null;
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
   * Deletes a collection
   *
   * @param {String} index
   * @param {String} collection
   *
   * @returns {Promise}
   */
  delete (request) {
    const { index, collection } = this.getIndexAndCollection(request);

    return this.publicStorage.deleteCollection(index, collection)
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

  /**
   * Return only the mapping properties we want to output in our API
   * @param  {Object} mapping - raw ES mapping
   * @returns {Object}
   */
  _filterMappingResponse (mapping) {
    return {
      _meta: mapping._meta,
      dynamic: mapping.dynamic,
      properties: mapping.properties
    };
  }
}

module.exports = CollectionController;
