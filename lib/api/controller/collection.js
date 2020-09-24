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
      'delete',
      'deleteSpecifications',
      'exists',
      'getMapping',
      'getSpecifications',
      'list',
      'refresh',
      'scrollSpecifications',
      'searchSpecifications',
      'truncate',
      'update',
      'updateMapping',
      'updateSpecifications',
      'validateSpecifications',
    ]);

    this.defaultScrollTTL = this.kuzzle.config.services.storageEngine.defaults.scrollTTL;
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

    const updated = await this.ask(
      'core:store:public:mappings:update',
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

    const mapping = await this.ask(
      'core:store:public:mappings:get',
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
  async searchSpecifications (request) {
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

    const { hits, scrollId, total } = await this.kuzzle.internalIndex.search(
      'validations',
      searchBody,
      { from, scroll: scrollTTL, size });

    return { hits, scrollId, total };
  }

  /**
   * Scroll over a paginated search results
   *
   * @param {Request} request
   * @returns {Promise.<object>}
   */
  async scrollSpecifications (request) {
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
  async updateSpecifications (request) {
    const { index, collection } = this.getIndexAndCollection(request);
    const specifications = this.getBody(request);

    const { isValid, errors } = await this.kuzzle.validation.validateFormat(
      index,
      collection,
      specifications,
      true);

    if (! isValid) {
      throw kerror.get(
        'validation',
        'assert',
        'invalid_specifications',
        errors.join('\n\t- '));
    }

    await this.kuzzle.internalIndex.createOrReplace(
      'validations',
      `${index}#${collection}`,
      {
        collection,
        index,
        validation: specifications,
      });

    await this.kuzzle.internalIndex.refreshCollection('validations');
    await this.kuzzle.validation.curateSpecification();

    return specifications;
  }

  /**
   * Add a specification collections
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async deleteSpecifications (request) {
    const { index, collection } = this.getIndexAndCollection(request);
    const specificationsId = `${index}#${collection}`;

    try {
      await this.kuzzle.internalIndex.delete('validations', specificationsId);
    }
    catch(error) {
      if (error.status === 404) {
        return {
          acknowledged: true,
        };
      }

      throw error;
    }

    await this.kuzzle.internalIndex.refreshCollection('validations');
    await this.kuzzle.validation.curateSpecification();

    return {
      acknowledged: true
    };
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
  async truncate (request) {
    const { index, collection } = this.getIndexAndCollection(request);

    await this.ask('core:store:public:collection:truncate', index, collection);

    return {
      acknowledged: true
    };
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
      const list = await this.ask('core:realtime:collections:get', index);
      collections = list.map(name => ({ name, type: 'realtime' }));
    }

    if (type !== 'realtime') {
      const publicCollections = await this.ask(
        'core:store:public:collection:list',
        index);

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

    return this.ask('core:store:public:collection:exist', index, collection);
  }

  /**
   * Creates a new collection with the specifed mappings and settings.
   * Only update the mappings and settings if the collection exists.
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async create (request) {
    const body = this.getBody(request, {});
    const { index, collection } = this.getIndexAndCollection(request);

    let config = {};

    // @deprecated sending directly the mappings is deprecated since 2.1.0
    if (body.properties || body.dynamic || body._meta) {
      config.mappings = body;
    }
    else {
      config = body;
    }

    await this.ask(
      'core:store:public:collection:create',
      index,
      collection,
      config);

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

    await this.ask(
      'core:store:public:collection:update',
      index,
      collection,
      config);

    return null;
  }

  /**
   * Refresh a collection
   *
   * @param {Request} request
   * @returns {Promise.<null>}
   */
  async refresh (request) {
    const { index, collection } = this.getIndexAndCollection(request);

    await this.ask('core:store:public:collection:refresh', index, collection);

    return null;
  }

  /**
   * Deletes a collection
   *
   * @param {String} index
   * @param {String} collection
   *
   * @returns {Promise.<null>}
   */
  async delete (request) {
    const { index, collection } = this.getIndexAndCollection(request);

    await this.ask('core:store:public:collection:delete', index, collection);

    return null;
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
