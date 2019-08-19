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

/*
  This is a light database service used by Kuzzle's core components, namely
  the plugins manager and the repositories.

  The differences with the standard database service are:

    - this service is not listed under kuzzle.services like other services, but
      is instead referenced in kuzzle.internalEngine.

    - This service is loaded prior to any other services and before the
      plugins manager

    - No plugins hooks are used in this service, because it is meant to be
      used by components before plugins initialization

    - Only the few database methods used by core components are implemented

    - Methods take detailed arguments, instead of request objects

    - Actions are limited to Kuzzle's internal index
 */

'use strict';

const
  _ = require('lodash'),
  Bluebird = require('bluebird'),
  ms = require('ms'),
  { Client: ESClient } = require('@elastic/elasticsearch'),
  semver = require('semver'),
  debug = require('../../kuzzleDebug')('kuzzle:services:internalEngine'),
  ESWrapper = require('../../util/esWrapper'),
  errorsManager = require('../../config/error-codes/throw').wrap('external', 'elasticsearch'),
  {
    getESIndex,
    extractIndex,
    extractIndexes,
    extractCollections
  } = require('../../util/esEmulator');

/**
 * @param {Kuzzle} kuzzle instance
 * @param {string} index
 * @constructor
 */
class InternalEngine {
  constructor (kuzzle, index) {
    this.kuzzle = kuzzle;
    this.client = null;
    this.esWrapper = null;
    this.bootstrap = null;
    this.config = this.kuzzle.config.services.internalEngine;
    this.dbConfig = this.kuzzle.config.services.db;
    this.index = index || this.dbConfig.internalIndex;
  }

  /**
   * Initialize the elasticsearch client
   *
   * @returns {object} client
   */
  init (bootstrap) {
    this.bootstrap = bootstrap;

    if (! this.client) {
      this.client = new ESClient(this.dbConfig.client);
      this.esWrapper = new ESWrapper(this.client);
    }

    return this.client.info()
      .then(response => {
        this.esVersion = response.version;

        if (this.esVersion && !semver.satisfies(this.esVersion.number, '7.x')) {
          errorsManager.throw('wrong_elasticsearch_version', this.esVersion.number);
        }
      })
      .then(() => this);
  }

  /**
   * Search documents from elasticsearch with a query
   * @param {string} collection - collection
   * @param {object} [body] - optional query body
   * @param {object} [options] - optional search arguments (from, size, scroll)
   * @returns {Promise} resolve documents matching the query
   */
  search (collection, body, { from, size, scroll }) {
    const
      request = {
        index: getESIndex(this.index, collection, { internal: true }),
        from,
        size,
        scroll
      };

    if (body) {
      for (const arg of [
        'aggregations',
        'highlight',
        'query',
        'sort'
      ]) {
        if (body[arg]) {
          if (!request.body) {
            request.body = {};
          }
          request.body[arg] = body[arg];
        }
      }

      if (!request.body) {
        request.body = { query: body };
      }
    }

    debug('Searching: %a', request);

    return this.client.search(request)
      .then(({ body: raw }) => {
        debug('> %a results fetched', raw.hits.hits.length);

        const result = raw.hits || { hits: [], total: 0 };

        if (raw.aggregations) {
          result.aggregations = raw.aggregations;
        }

        // register the scroll id (if any)
        if (raw._scroll_id) {
          const
            ttl = ms(scroll) || ms(this.dbConfig.defaults.scrollTTL),
            key = collection + this.kuzzle.constructor.hash(raw._scroll_id);

          result.scrollId = raw._scroll_id;

          return this.kuzzle.services.list.internalCache.psetex(key, ttl, 0)
            .then(() => result);
        }

        return result;
      })
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Returns the next page of a scroll search
   *
   * @param {string} collection
   * @param {string} scrollId
   * @param {string} [ttl]
   * @return {Promise}
   */
  scroll (collection, scrollId, ttl = this.dbConfig.defaults.scrollTTL) {
    const
      request = {
        scrollId,
        scroll: ttl
      },
      cacheKey = collection + this.kuzzle.constructor.hash(scrollId);

    return this.kuzzle.services.list.internalCache.exists(cacheKey)
      .then(exists => {
        if (exists === 0) {
          errorsManager.throw('unknown_scroll_identifier');
        }

        // ms(ttl) may return undefined if in microseconds or in nanoseconds
        const msttl = ms(ttl) || ms(this.dbConfig.defaults.scrollTTL);

        return this.kuzzle.services.list.internalCache.pexpire(cacheKey, msttl);
      })
      .then(() => this.client.scroll(request))
      .then(({ body: raw }) => {
        const result = raw.hits || { hits: [], total: 0 };

        result.scrollId = raw._scroll_id;

        return result;
      })
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   *
   * @param collection
   * @param id
   */
  exists (collection, id) {
    return this.client.exists({
      index: getESIndex(this.index, collection, { internal: true }),
      id
    })
      .then(({ body }) => body)
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Get the document with given ID
   *
   * @param {string} collection - collection
   * @param {string} id - id of the document to retrieve
   * @returns {Promise} resolve the document
   */
  get (collection, id) {
    const request = {
      index: getESIndex(this.index, collection, { internal: true }),
      id
    };

    return this.client.get(request)
      .then(({ body }) => body)
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Return the list of documents matching the ids given in the body param
   * NB: Due to internal Kuzzle mechanism, can only be called on a single index/collection,
   * using the body { ids: [.. } syntax.
   *
   * @param {string} collection - collection name
   * @param {array} ids - list of document IDs to get
   * @returns {Promise}
   */
  mget (collection, ids) {
    const request = {
      index: getESIndex(this.index, collection, { internal: true }),
      body: { ids }
    };

    return this.client.mget(request)
      .then(({ body: result }) => {
        // harmonize response format based upon the search one
        if (result.docs) {
          result.hits = result.docs;
          delete result.docs;
        }

        return result;
      })
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Create a new document to ElasticSearch, or replace it if it already exist
   *
   * @param {string} collection - collection name
   * @param {string} id - document ID
   * @param {object} body
   * @param {object} [options]
   * @returns {Promise}
   */
  createOrReplace (collection, id, body, options = {}) {
    const request = {
      index: getESIndex(this.index, collection, { internal: true }),
      id,
      body
    };

    if (options.refresh === 'wait_for') {
      request.refresh = 'wait_for';
    }

    // extends the response with the source from request
    // When we write in ES, the response doesn't contain the initial document body
    return this.client.index(request)
      .then(({ body: result }) => ({ ...result, _source: body }))
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Replace a document with new content
   *
   * @param {string} collection - collection name
   * @param {string} id - document ID
   * @param {object} body
   * @param {object} [options]
   * @returns {Promise}
   */
  replace (collection, id, body, options = {}) {
    return this.exists(collection, id)
      .then(({ body: exists }) => {
        if (! exists) {
          errorsManager.throw('document_not_found', id);
        }

        return this.createOrReplace(collection, id, body, options);
      });
  }

  /**
   * Send to elasticsearch the new document
   *
   * @param {string} collection - collection name
   * @param {string} id - document ID
   * @param {object} body
   * @param {object} [options]
   * @returns {Promise}
   */
  create (collection, id, body, options = {}) {
    const promise = id
      ? this.exists(collection, id)
      : Promise.resolve({ body: false });

    return promise
      .then(({ body: exists }) => {
        if (exists) {
          errorsManager.throw('document_already_exists', id);
        }

        return this.createOrReplace(collection, id, body, options);
      });
  }

  /**
   * Performs a partial update to a document
   *
   * @param {string} collection - collection name
   * @param {string} id of the document to update
   * @param {object} updateContent
   * @param {object} [options]
   * @returns {Promise} resolve an object that contains _id
   */
  update (collection, id, updateContent, options = {}) {
    return this.exists(collection, id)
      .then(({ body: exists }) => {
        if (! exists) {
          errorsManager.throw('document_not_found', id);
        }

        const request = {
          index: getESIndex(this.index, collection, { internal: true }),
          id,
          body: {
            doc: updateContent
          }
        };

        if (options.refresh === 'wait_for') {
          request.refresh = 'wait_for';
        }

        if (options.retryOnConflict) {
          request.retryOnConflict = options.retryOnConflict;
        }
        else {
          request.retryOnConflict = this.dbConfig.defaults.onUpdateConflictRetries;
        }

        return this.client.update(request);
      })
      .then(({ body }) =>  body)
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }


  /**
   * Send to elasticsearch the document id to delete
   *
   * @param {string} collection - collection name
   * @param {string} id - id of the document to delete
   * @param {object} [options]
   * @returns {Promise} resolve an object that contains _id
   */
  delete (collection, id, options = {}) {
    return this.exists(collection, id)
      .then(exists => {
        if (! exists) {
          errorsManager.throw('document_not_found', id);
        }

        const request = {
          index: getESIndex(this.index, collection, { internal: true }),
          id
        };

        if (options.refresh === 'wait_for') {
          request.refresh = 'wait_for';
        }

        return this.client.delete(request);
      })
      .then(({ body }) =>  body)
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Get a map of existing aliases in elasticsearch
   * {
   *    alias1: index,
   *    alias2: index2,
   *    [..]
   * }
   *
   * @returns {Promise<object>}
   */
  listAliases() {
    return this.client.cat.aliases({
      format: 'json'
    })
      .then(({ body: aliases }) => {
        const aliasMap = {};

        for (const entry of aliases) {
          aliasMap[entry.alias] = extractIndex(entry.index, { internal: true });
        }

        return aliasMap;
      });
  }

  /**
   * Get the list of existing indexes in elasticsearch
   *
   * @returns {Promise}
   */
  listIndexes () {
    return this.client.indices.getMapping()
      .then(({ body: mappings }) =>
        extractIndexes(Object.keys(mappings), { internal: true }))
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Get the list of existing collections in elasticsearch
   *
   * @returns {Promise}
   */
  listCollections (index) {
    return this.client.indices.getMapping()
      .then(({ body: mappings }) => extractCollections(
        Object.keys(mappings),
        index, { internal: true })
      )
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Tell whether a collection exists or not
   *
   * @param {string} collection
   */
  collectionExists (collection) {
    return this.client.indices.exists({
      index: getESIndex(this.index, collection, { internal: true })
    })
    .then(({ body }) => body)
    .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Retrieve mapping definiton of index or index/collection
   *
   * @returns {Promise}
   */
  getMapping (index, collection, includeKuzzleMeta = false) {
    const esIndex = getESIndex(index, collection, { internal: true });

    return this.esWrapper.getMapping({ index: esIndex }, includeKuzzleMeta);
  }

  /**
   * Deletes an internal index
   *
   * @returns {Promise<Array<string>>} - Deleted collections
   */
  async deleteIndex (index = this.index) {
    const
      collections = await this.listCollections(index),
      promises = [];

    for (const collection of collections) {
      promises.push(
        this.client.indices.delete({
          index: getESIndex(index, collection, { internal: true })
        })
      );
    }

    try {
      await Promise.all(promises);
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }

    return collections;
  }

  /**
   * Add a mapping definition to a specific collection
   *
   * @param {string} collection - collection
   * @param {object} mapping
   * @param {string} index - index (default to this.index)
   * @return {Promise}
   */
  updateMapping (collection, mapping, index = this.index) {
    const request = {
      index: getESIndex(index, collection, { internal: true }),
      body: mapping
    };

    return this.client.indices.putMapping(request)
      .then(({ body }) => body)
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Refreshes the internal index
   * @returns {Promise}
   */
  async refresh () {
    const
      collections = await this.listCollections(this.index),
      promises = [];

    for (const collection of collections) {
      promises.push(
        this.client.indices.refresh({
          index: getESIndex(this.index, collection, { internal: true })
        })
      );
    }

    try {
      await Promise.all(promises);
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }

    return collections;
  }

  /**
   * Check if an user with the "admin" profile exists.
   *
   * @return {Promise<boolean>} - True if an admin already exists
   */
  async adminExists () {
    const query = {
      terms: { profileIds: ['admin'] }
    };

    const { body: result } =
      await this.search('users', { query }, { from: 0, size: 0 });

    return result.total > 0;
  }

  /**
   * Create a collection with the specified mapping
   * @param {string} collection
   * @param {object} mappings
   *
   * @returns {Promise}
   */
  async createCollection (collection, mappings = {}) {
    const
      esIndex = getESIndex(this.index, collection, { internal: true }),
      esRequest = { index: esIndex };

    try {
      const exists = await this.collectionExists(collection);

      if (! exists) {
        esRequest.body = { mappings };
        await this.client.indices.create(esRequest)
      } else {
        esRequest.body = mappings;
        await this.client.indices.putMapping(esRequest);
      }
    } catch (error) {
      throw this.esWrapper.formatESError(error);
    }
  }

  /**
   * Apply default mapping to the collection but preserve existing
   * kuzzle metadata
   *
   * @param {string} index
   * @param {string} collection
   * @param {object} mapping
   * @returns {Promise.<object>} returns the updated default mapping
   */
  applyDefaultMapping (index, collection, mapping) {
    const defaultMapping = _.cloneDeep(mapping);

    return this.getMapping({ index, type: collection }, true)
      .then(mappings => {
        const updatedMapping = {};

        for (const mappingIndex of Object.keys(mappings)) {
          const existingMapping = mappings[mappingIndex].mappings[collection];

          // Preserve old version of kuzzle metadata mapping
          if (
            existingMapping.properties &&
            existingMapping.properties._kuzzle_info
          ) {
            Object.assign(
              defaultMapping._kuzzle_info.properties,
              existingMapping.properties._kuzzle_info.properties
            );
          }

          updatedMapping[collection] = {
            dynamic: existingMapping.dynamic || this.dbConfig.dynamic,
            _meta: existingMapping._meta || {},
            properties: defaultMapping
          };
        }

        return this.updateMapping(collection, updatedMapping, index);
      })
      .then(() => defaultMapping);
  }
}

module.exports = InternalEngine;
