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
  _ = require('lodash'),
  Bluebird = require('bluebird'),
  ESWrapper = require('../util/esWrapper'),
  didYouMean = require('../util/didYouMean'),
  Service = require('./service'),
  { Request } = require('kuzzle-common-objects'),
  { Client: ESClient } = require('@elastic/elasticsearch'),
  ms = require('ms'),
  errorsManager = require('../config/error-codes/throw'),
  { assertIsObject } = require('../util/requestAssertions'),
  semver = require('semver');

const scrollCachePrefix = '_docscroll_';

const rootMappingProperties = ['properties', '_meta', 'dynamic'];
const childMappingProperties = ['type'];

// Used for collection emulation
const
  INTERNAL_PREFIX = '%',
  USER_PREFIX = '&',
  NAME_SEPARATOR = '.';

 /**
 * @property {Kuzzle} kuzzle
 * @property {object} settings
 * @property {object} client
 * @param {Kuzzle} kuzzle kuzzle instance
 * @param {object} options used to start the service
 * @param {object} config used to start the service
 * @param {string} indexType - "internal" or "user" (default "user")
 * @constructor
 */
class ElasticSearch extends Service {
  constructor(kuzzle, options, config, indexType = 'user') {
    super('elasticsearch');

    this.kuzzle = kuzzle;
    this.internal = indexType === 'internal';
    this.config = config;
    this.settings = {
      service: options.service,
      autoRefresh: options.autoRefresh || {}
    };
    this.client = null;
    this.esWrapper = null;
    this.esVersion = null;
  }

  /**
   * Initialize the elasticsearch client
   *
   * @returns {Promise}
   */
  init () {
    if (this.client) {
      return Bluebird.resolve(this);
    }

    if (process.env.NODE_ENV === 'production' && this.config.dynamic === 'true') {
      this.kuzzle.log.warn('Your dynamic mapping policy is set to \'true\' for new fields.\nElasticsearch will try to automatically infer mapping for new fields, and those cannot be changed afterward.\nSee the "services.db.dynamic" option in the kuzzlerc configuration file to change this value.'
      );
    }

    this.client = this._buildClient(this.config);
    this.esWrapper = new ESWrapper(this.client);

    return this.client.info()
      .then(({ body }) => {
        this.esVersion = body.version;

        if (this.esVersion && !semver.satisfies(this.esVersion.number, '7.x')) {
          this.throw('wrong_elasticsearch_version', this.esVersion.number);
        }

        return this;
      });
  }

  /**
   * Return some basic information about this service
   *
   * @returns {Promise} service informations
   */
  getInfos () {
    const response = {
      type: 'elasticsearch'
    };

    return this.client.info()
      .then(({ body }) => {
        response.version = body.version.number;
        response.lucene = body.version.lucene_version;

        return this.client.cluster.health();
      })
      .then(({ body }) => {
        response.status = body.status;
        response.nodes = body.number_of_nodes;

        return this.client.cluster.stats({ human: true });
      })
      .then(({ body }) => {
        response.spaceUsed = body.indices.store.size;
        response.nodes = body.nodes;

        return response;
      })
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Scroll results from previous elasticsearch query
   *
   * @param {string} index - Index name
   * @param {string} collection - Collection name
   * @param {string} scrollId - Scroll identifier
   * @param {object} options - scroll (default scrollTTL)
   *
   * @returns {Promise} { scrollId, hits, total }
   */
  scroll (index, collection, scrollId, { scroll=this.config.defaults.scrollTTL }) {
    const esRequest = {
      index: this._getESIndex(index, collection),
      scroll,
      scrollId
    };

    const cacheKey = scrollCachePrefix + this.kuzzle.constructor.hash(
      esRequest.scrollId
    );

    return this.kuzzle.services.list.internalCache.exists(cacheKey)
      .then(exists => {
        if (exists === 0) {
          this.throw('unknown_scroll_identifier');
        }

        // ms(scroll) may return undefined if in microseconds or in nanoseconds
        const ttl = ms(esRequest.scroll) || ms(this.config.defaults.scrollTTL);

        return this.kuzzle.services.list.internalCache.pexpire(cacheKey, ttl);
      })
      .then(() => this.client.scroll(esRequest))
      .then(({ body }) => {
        const apiResponse = {
          scrollId: body.scrollId,
          hits: body.hits,
          total: body.total
        };

        return apiResponse;
      })
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Search documents from elasticsearch with a query
   *
   * @param {string} index - Index name
   * @param {string} collection - Collection name
   * @param {object} body - Request body (query, sort, etc.)
   * @param {object} options - from (null), size (null), scroll (null)
   *
   * @returns {Promise} { scrollId, hits, aggregations, total }
   */
  search (index, collection, body, { from=null, size=null, scroll=null }) {
    const esRequest = {
      index: this._getESIndex(index, collection),
      body,
      from,
      size,
      scroll
    };

    return this.client.search(esRequest)
      .then(({ body }) => {
        const apiResponse = {
          scrollId: body.scrollId,
          hits: body.hits,
          aggregations: body.aggregations,
          total: body.total
        };

        if (apiResponse.scrollId) {
          const
            // ms(scroll) may return undefined if in microseconds or in nanoseconds
            ttl = ms(esRequest.scroll) || ms(this.config.defaults.scrollTTL),
            key = scrollCachePrefix + this.kuzzle.constructor.hash(
              apiResponse.scrollId
            );

          return this.kuzzle.services.list.internalCache.psetex(key, ttl, 0)
            .then(() => apiResponse);
        }

        return apiResponse;
      })
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Get the document with given ID
   *
   * @param {string} index - Index name
   * @param {string} collection - Collection name
   * @param {string} id - Document ID
   *
   * @returns {Promise} { _id, _version, _source }
   */
  get (index, collection, id) {
    const esRequest = {
      index: this._getESIndex(index, collection),
      id
    };

    // Just in case the user make a GET on url /mainindex/test/_search
    // Without this test we return something weird: a result.hits.hits with all document without filter because the body is empty in HTTP by default
    if (esRequest.id === '_search') {
      return this.reject('wrong_get_action');
    }

    return this.client.get(esRequest)
      .then(({ body }) => {
        const apiResponse = {
          _id: body._id,
          _version: body._version,
          _source: body._source
        };

        return apiResponse;
      })
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Return the list of documents matching the ids given in the body param
   * NB: Due to internal Kuzzle mechanism, can only be called on a single index/collection,
   * using the body { ids: [.. } syntax.
   *
   * @param {string} index - Index name
   * @param {string} collection - Collection name
   * @param {Array<string>} ids - Document IDs
   *
   * @returns {Promise} { hits, total }
   */
  mget (index, collection, ids) {
    const esRequest = {
      index: this._getESIndex(index, collection),
      body: ids
    };

    return this.client.mget(esRequest)
      .then(({ body }) => {
        const apiResponse = {
          hits: body.docs,
          total: body.total
        };

        return apiResponse;
      })
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Count how many documents match the filter given in body
   *
   * @param {string} index - Index name
   * @param {string} collection - Collection name
   * @param {object} query - Query to match
   *
   * @returns {Promise} { count }
   */
  count (index, collection, query = {}) {
    const esRequest = {
      index: this._getESIndex(index, collection),
      body: query
    };

    return this.client.count(esRequest)
      .then(({ body }) => {
        const apiResponse = {
          count: body.count
        };

        return apiResponse;
      })
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Sends the new document to elasticsearch
   * Cleans data to match elasticsearch specifications
   *
   * @param {string} index - Index name
   * @param {string} collection - Collection name
   * @param {object} content - Document content
   * @param {object} options - id (null), refresh (null), userId (null)
   *
   * @returns {Promise} { _id, _version, _source }
   */
  create (index, collection, content, { id=null, refresh=null, userId=null }) {
    assertIsObject(content);

    const esRequest = {
      index: this._getESIndex(index, collection),
      body: content,
      id,
      refresh
    };

    assertNoRouting(esRequest);
    assertWellFormedRefresh(esRequest);

    return this.kuzzle.indexCache.exists(index, collection)
      .then(exists => {
        if (! exists) {
          this.throw(
            'index_or_collection_does_not_exist',
            index,
            collection);
        }

        // Add metadata
        esRequest.body._kuzzle_info = {
          author: String(userId),
          createdAt: Date.now(),
          updatedAt: null,
          updater: null
        };

        const promise = esRequest.id
          ? this.client.exists({ index: esRequest.index, id: esRequest.id })
          : Bluebird.resolve({ body: false });

        return promise;
      })
      .then(({ body: exists }) => {
        if (exists) {
          return this.reject('document_already_exists', esRequest.id);
        }

        return this.client.index(esRequest);
      })
      .then(({ body }) => {
        const apiResponse = {
          _id: body._id,
          _version: body._version,
          _source: esRequest.body
        };

        return apiResponse;
      })
      .catch(error => this.esWrapper.reject(error));
}

  /**
   * Create a new document to ElasticSearch, or replace it if it already exist
   *
   * @param {string} index - Index name
   * @param {string} collection - Collection name
   * @param {string} id - Document id
   * @param {object} content - Document content
   * @param {object} options - refresh (null), userId (null), injectKuzzleMeta (false)
   *
   * @returns {Promise} { _id, _version, _source, created }
   */
  createOrReplace (
    index,
    collection,
    id,
    content,
    { refresh=null, userId=null, injectKuzzleMeta=false })
  {
    const esRequest = {
      index: this._getESIndex(index, collection),
      id,
      body: content,
      refresh
    };

    assertNoRouting(esRequest);
    assertWellFormedRefresh(esRequest);

    return this.kuzzle.indexCache.exists(index, collection)
      .then(exists => {
        if (! exists) {
          this.throw(
            'index_or_collection_does_not_exist',
            index,
            collection);
        }

        // Add metadata
        if (injectKuzzleMeta) {
          esRequest.body._kuzzle_info = {
            author: String(userId),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            updater: String(userId)
          };
        }

        return this.client.index(esRequest);
      })
      .then(({ body }) => {
        const apiResponse = {
          _id: body._id,
          _version: body._version,
          _source: esRequest.body,
          created: body.created
        };

        return apiResponse;
      })
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Sends the partial document to elasticsearch
   * with the id to update
   *
   * @param {string} index - Index name
   * @param {string} collection - Collection name
   * @param {string} id - Document id
   * @param {object} content - Updated content
   * @param {object} options - refresh (null), userId (null), retryOnConflict (0)
   *
   * @returns {Promise} { _id, _version }
   */
  update (
    index,
    collection,
    id,
    content,
    { refresh=null, userId=null, retryOnConflict=-1 })
  {
    const esRequest = {
      index: this._getESIndex(index, collection),
      id,
      refresh,
      retryOnConflict
    };

    // injecting retryOnConflict default configuration
    if (esRequest.retryOnConflict === 0
      && this.config.defaults.onUpdateConflictRetries > 0
    ) {
      esRequest.retryOnConflict = this.config.defaults.onUpdateConflictRetries;
    }

    assertNoRouting(esRequest);
    assertWellFormedRefresh(esRequest);

    return this.kuzzle.indexCache.exists(index, collection)
      .then(exists => {
        if (! exists) {
          this.throw(
            'index_or_collection_does_not_exist',
            index,
            collection);
        }

        // Add metadata
        content._kuzzle_info = {
          updatedAt: Date.now(),
          updater: String(userId)
        };

        esRequest.body = { doc: content };

        return this.client.update(esRequest);
      })
      .then(({ body }) => {
        const apiResponse = {
          _id: body._id,
          _version: body._version
        };

        return apiResponse;
      })
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Replace a document to ElasticSearch
   *
   * @param {string} index - Index name
   * @param {string} collection - Collection name
   * @param {string} id - Document id
   * @param {object} content - Document content
   * @param {object} options - refresh (null), userId (null)
   *
   * @returns {Promise} { _id, _version, _source }
   */
  replace (index, collection, id, content,  { refresh=null, userId=null }) {
    const
      esIndex = this._getESIndex(index, collection),
      esRequest = {
        index: esIndex,
        id,
        body: content,
        refresh
      };

    esRequest.id = request.input.resource._id;
    esRequest.body = request.input.body;

    assertNoRouting(esRequest);
    assertWellFormedRefresh(esRequest);

    return this.kuzzle.indexCache.exists(index, collection)
      .then(exists => {
        if (! exists) {
          this.throw(
            'index_or_collection_does_not_exist',
            index,
            collection);
        }

        // Add metadata
        esRequest.body._kuzzle_info = {
          author: String(userId),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          updater: String(userId)
        };

        return this.client.exists({ index: esIndex, id });
      })
      .then(({ body: exists }) => {
        if (! exists) {
          return this.reject('document_not_found', id);
        }

        return this.client.index(esRequest);
      })
      .then(({ body }) => {
        const apiResponse = {
          _id: id,
          _version: body._version,
          _source: esRequest.body
        };

        return apiResponse;
      });
  }

  /**
   * Send to elasticsearch the document id to delete
   *
   * @param {string} index - Index name
   * @param {string} collection - Collection name
   * @param {string} id - Document id
   * @param {object} options - refresh (null)
   *
   * @returns {Promise} { _id }
   */
  delete (index, collection, id, { refresh=null }) {
    const esRequest = {
      index: this._buildClient._getESIndex(index, collection),
      id,
      refresh,
      retryOnConflict
    };

    assertWellFormedRefresh(esRequest);

    return this.client.delete(esRequest)
      .then(() => {
        const apiResponse = {
          _id: id
        };

        return apiResponse;
      })
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Delete all documents matching the provided filters
   *
   * @param {string} index - Index name
   * @param {string} collection - Collection name
   * @param {object} query - Query to match documents
   * @param {object} options - from (null), size (null)
   *
   * @returns {Promise} { ids }
   */
  deleteByQuery (
    index,
    collection,
    query,
    { refresh=null, from=null, size=null })
  {
    const esRequest = {
      index: this._getESIndex(index, collection),
      body: { query },
      scroll: '30s',
      from,
      size,
      refresh
    };

    if (! _.isPlainObject(query)) {
      return this.reject('empty_query');
    }

    return this._fetchIds(esRequestSearch)
      .then(ids => {

        if (esRequestBulk.body.length === 0) {
          return Bluebird.resolve({ids: []});
        }

        return this.client.bulk(esRequestBulk)
          .then(() => this.refreshESIndexIfNeeded(esRequestBulk, {ids}))
          .catch(error => Bluebird.reject(
            this.esWrapper.formatESError(error))
          );
      });
  }

  /**
   * Delete all document that match the given filter from the trash
   * @param {Request} request
   * @returns {Promise} resolve the list of deleted ids
   */
  deleteByQueryFromTrash(request) {
    const
      esRequestSearch = initESRequest(request, ['from', 'size', 'scroll']),
      esRequestBulk = initESRequest(request, ['refresh']);

    assertWellFormedRefresh(esRequestBulk);

    esRequestSearch.body = request.input.body;
    esRequestSearch.scroll = '30s';

    if (esRequestSearch.body.query === null) {
      return Bluebird.reject(this.getError('document_id_cannot_be_null'));
    }

    return getAllIdsFromQuery(this.client, esRequestSearch)
      .then(ids => {
        return new Bluebird((resolve, reject) => {
          esRequestBulk.body = ids.map(id => ({delete:
            {_index: esRequestBulk.index,
              _type: esRequestBulk.type,
              _id: id}
          }));

          if (esRequestBulk.body.length === 0) {
            return resolve({ids: []});
          }

          return this.client.bulk(esRequestBulk)
            .then(() => this.refreshESIndexIfNeeded(esRequestBulk, {ids}))
            .catch(error => reject(this.esWrapper.formatESError(error)));
        });
      });
  }

  /**
   * Create an empty collection. Mapping will be applied if supplied.
   *
   * @param {Request} request
   * @returns {Promise}
   */
  createCollection(request) {
    const esRequest = initESRequest(request);

    return this.kuzzle.indexCache.exists(esRequest.index)
      .then(indexExists => {
        if (! indexExists) {
          this.throw('index_does_not_exist');
        }

        return this.kuzzle.indexCache.exists(index, collection);
      })
      .then(collectionExists => {
        if (collectionExists) {
          return this.updateMapping(request);
        }

        const requestBody = request.input.body || {};

        this._checkMapping(requestBody);

        esRequest.body = this._mergeDefaultMapping(
          esRequest.index,
          {},
          requestBody
        );

        return this.client.indices.putMapping(esRequest)
          .catch(error => Bluebird.reject(
            this.esWrapper.formatESError(error))
          );
      });
  }

  /**
   * Empty the content of a collection. Keep the existing mapping.
   *
   * @param {Request} request
   * @returns {Promise}
   */
  truncateCollection(request) {
    const
      deleteRequest = new Request({
        index: request.input.resource.index,
        collection: request.input.resource.collection,
        body: {
          query: {
            match_all: {}
          }
        }
      }, {
        user: request.context.user
      });

    deleteRequest.input.args.refresh = request.input.args.refresh || false;

    return this.deleteByQuery(deleteRequest)
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Run several action and document
   *
   * @param {Request} request
   * @returns {Promise}
   */
  import(request) {
    const
      actionNames = ['index', 'create', 'update', 'delete'],
      esRequest = initESRequest(request,
        ['consistency', 'refresh', 'timeout', 'fields']),
      userId = this._getUserId(request),
      dateNow = Date.now();

    assertWellFormedRefresh(esRequest);

    if (!request.input.body || !(request.input.body.bulkData instanceof Object)) {
      return Bluebird.reject(
        this.getError('missing_or_invalid_import_attribute')
      );
    }

    esRequest.body = request.input.body.bulkData;
    const kuzzleMetaCreated = {
      author: userId,
      createdAt: dateNow,
      updatedAt: null,
      updater: null,
      active: true,
      deletedAt: null
    };
    const kuzzleMetaUpdated = {
      updater: userId,
      updatedAt: dateNow
    };

    const esCache = {};

    return this.client.indices.getMapping()
      .then(raw => {
        for (const index of Object.keys(raw)) {
          esCache[index] = Object.keys(raw[index].mappings);
        }

        return this.client.cat.aliases({
          format: 'json'
        });
      })
      .then(aliases => {
        for (const entry of aliases) {
          esCache[entry.alias] = esCache[entry.index];
        }

        // set missing index & type if possible and add metadata
        let lastAction; // NOSONAR

        for (let i = 0; i < esRequest.body.length; i++) {
          const item = esRequest.body[i];
          const action = Object.keys(item)[0];

          if (actionNames.indexOf(action) !== -1) {
            lastAction = action;

            if (!item[action]._type && collection) {
              item[action]._type = collection;
            }

            if (!item[action]._type) {
              return Bluebird.reject(this.getError(
                'missing_data_collection_argument')
              );
            }

            if (!item[action]._index && esRequest.index) {
              item[action]._index = esRequest.index;
            }

            if (!item[action]._index) {
              return Bluebird.reject(this.getError(
                'missing_data_index_argument')
              );
            }

            if (! (esCache[item[action]._index] &&
              esCache[item[action]._index].includes(item[action]._type))) {
              return Bluebird.reject(this.getError(
                'index_or_collection_does_not_exist',
                item[action]._index, item[action]._type)
              );
            }

            if (item[action]._index === this.kuzzle.internalEngine.index) {
              return Bluebird.reject(
                this.getError('index_protected',
                  this.kuzzle.internalEngine.index)
              );
            }
          } else if (lastAction === 'index' || lastAction === 'create') {
            item._kuzzle_info = kuzzleMetaCreated;
          } else if (lastAction === 'update') {
            // we can only update metadata on a partial update, or on an upsert
            for (const prop of ['doc', 'upsert']) {
              if (_.isPlainObject(item[prop])) {
                item[prop]._kuzzle_info = kuzzleMetaUpdated;
              }
            }
          }
        }

        return this.client.bulk(esRequest);
      })
      .then(response => this.refreshESIndexIfNeeded(esRequest, response))
      .then(result => {

        // If some errors occured during the Bulk, we send a "Partial Error" response :
        if (result.errors) {
          result.partialErrors = [];
          const items = [];
          let row;

          while ((row = result.items.shift()) !== undefined) {
            const
              action = Object.keys(row)[0],
              item = row[action];

            if (item.status >= 400) {
              item.action = action;
              result.partialErrors.push(item);
            }
            else {
              items.push(row);
            }
          }

          result.items = items;
        }

        return result;
      })
      .catch(err => Bluebird.reject(this.esWrapper.formatESError(err)));
  }

  /**
   * Add a mapping definition to a specific type
   *
   * @param {Request} request
   * @return {Promise}
   */
  updateMapping(request) {
    const esRequest = initESRequest(request);

    return this.esWrapper.getMapping(esRequest, true)
      .then(mappings => {
        const collectionMapping =
          mappings[esRequest.index].mappings[collection];
        const requestBody = request.input.body || {};

        this._checkMapping(requestBody);

        esRequest.body = this._mergeDefaultMapping(
          esRequest.index,
          collectionMapping,
          requestBody
        );

        return this.client.indices.putMapping(esRequest)
          .catch(error => Bluebird.reject(
            this.esWrapper.formatESError(error))
          );
      });
  }

  /**
   * Retrieve mapping definition for index/type
   *
   * @param {Request} request
   * @return {Promise}
   */
  getMapping(request, includeKuzzleMeta = false) {
    const esRequest = initESRequest(request);

    return this.esWrapper.getMapping(esRequest, includeKuzzleMeta);
  }

  /**
   * Retrieve the complete list of existing data collections in the current index
   *
   * @param {Request} request
   * @return {Promise}
   */
  listCollections(request) {
    const esRequest = initESRequest(request);

    // fix #1131: we should ignore the "collection" argument even if
    // one is provided, as "listing the provided collection name"
    // makes no sense
    delete collection;

    return this.client.indices.getMapping(esRequest)
      .then(result => {
        let collections = [];

        if (result[request.input.resource.index]) {
          collections = Object.keys(
            result[request.input.resource.index].mappings
          );
        }

        return {collections: {stored: collections}};
      })
      .catch(error => Bluebird.reject(
        this.esWrapper.formatESError(error))
      );
  }

  /**
   * Reset all indexes that the users is allowed to delete
   *
   * @param {Request} request
   * @return {Promise}
   */
  deleteIndexes(request) {
    const deletedIndexes = request.input.body.indexes;

    if (deletedIndexes === undefined || deletedIndexes.length === 0) {
      return Bluebird.resolve({deleted: []});
    }

    return this.client.indices.delete({index: deletedIndexes})
      .then(() => ({deleted: deletedIndexes}))
      .catch(error => Bluebird.reject(
        this.esWrapper.formatESError(error))
      );
  }

  /**
   * List all known indexes
   *
   * @returns {Promise}
   */
  listIndexes() {
    return this.client.indices.getMapping()
      .then(result => ({
        indexes: Object.keys(result).filter(
          indexName => indexName !== '' && indexName[0] !== '%')
      }))
      .catch(error => Bluebird.reject(
        this.esWrapper.formatESError(error))
      );
  }

  /**
   * Create a new index
   *
   * @param {Request} request
   * @returns {Promise}
   */
  createIndex(request) {
    const index = getIndex(request);

    return this.client.indices.create({index})
      .catch(error => Bluebird.reject(
        this.esWrapper.formatESError(error))
      );
  }

  /**
   * Delete an index
   *
   * @param {Request} request
   * @returns {Promise}
   */
  deleteIndex(request) {
    const index = getIndex(request);

    delete this.settings.autoRefresh[index];

    return this.client.indices.delete({index})
      .catch(error => Bluebird.reject(
        this.esWrapper.formatESError(error))
      );
  }

  /**
   * Forces a refresh on the index.
   *
   * /!\ Can lead to some performance issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html for more details
   *
   * @param {Request} request
   * @returns {Promise}
   */
  refreshIndex(request) {
    const index = getIndex(request);

    return this.client.indices.refresh({index})
      .catch(error => Bluebird.reject(
        this.esWrapper.formatESError(error))
      );
  }

  /**
   * @param {Request} request
   * @returns {Promise}
   */
  indexExists(request) {
    const esRequest = initESRequest(request);

    return this.client.indices.exists(esRequest)
      .catch(error => Bluebird.reject(
        this.esWrapper.formatESError(error))
      );
  }

  /**
   * @param {Request} request
   * @returns {Promise}
   */
  collectionExists(request) {
    const esRequest = initESRequest(request);

    return this.client.indices.existsType(esRequest)
      .catch(error => Bluebird.reject(
        this.esWrapper.formatESError(error))
      );
  }

  /**
   * gets the autorefresh value currently set for the given index
   *
   * @param {Request} request
   * @returns {Promise}
   */
  getAutoRefresh(request) {
    const index = getIndex(request);

    return Bluebird.resolve(this.settings.autoRefresh[index] === true);
  }

  /**
   * (dis|en)able the autorefresh for the index given in the request.
   *
   * @param {Request} request
   * @returns {Promise}
   */
  setAutoRefresh(request) {
    const index = getIndex(request);

    if (request.input.body.autoRefresh === true) {
      this.settings.autoRefresh[index] = true;
    }
    else {
      delete this.settings.autoRefresh[index];
    }

    return this.saveSettings()
      .then(() => this.getAutoRefresh(request));
  }

  /**
   * Create multiple documents at once.
   * If a content has no id, one is automatically generated and assigned to it.
   * If a content has a specified identifier, it is rejected if it already exists, unless
   * it's inactive, in which case it is revived
   *
   * @param  {Request} request - Kuzzle API request
   * @return {Promise}
   */
  mcreate(request) {
    const
      index = request.input.resource.index,
      type = request.input.resource.collection,
      extracted = extractMDocuments(request, {
        _kuzzle_info: {
          active: true,
          author: this._getUserId(request),
          updater: null,
          updatedAt: null,
          deletedAt: null,
          createdAt: Date.now()
        }
      });

    // prepare the mget request, but only for document having a specified id
    let mgetRequest;

    if (extracted.mgetRequest.body.docs.length > 0) {
      mgetRequest = this.client.mget(extracted.mgetRequest);
    } else {
      mgetRequest = Bluebird.resolve({docs: []});
    }

    return mgetRequest
      .then(mgetResult => {
        const
          esRequest = initESRequest(request,
            ['consistency', 'refresh', 'timeout', 'fields']
          ),
          toImport = [];

        let idx = 0;

        esRequest.body = [];

        for (let i = 0; i < extracted.documents.length; i++) {
          const document = extracted.documents[i];

          if (typeof document._id === 'string') {
            // document._id should always be equal to mgetResult.docs[idx]._id
            // if the document is not found in ES, or if it is in the trashcan,
            // then we accept to create (or replace) it
            if (!mgetResult.docs[idx].found ||
              (mgetResult.docs[idx]._source._kuzzle_info &&
                !mgetResult.docs[idx]._source._kuzzle_info.active)) {
              esRequest.body.push(
                {index:
                  {_index: index,
                    _type: type,
                    _id: document._id}
                });
              esRequest.body.push(document._source);
              toImport.push(document);
            } else {
              extracted.rejected.push(
                {document: request.input.body.documents[i],
                  reason: 'document already exists'}
              );
            }

            idx++;
          } else {
            esRequest.body.push({index: {_index: index, _type: type}});
            esRequest.body.push(document._source);
            toImport.push(document);
          }
        }

        return this._mexecute(esRequest, toImport, extracted.rejected);
      });
  }

  /**
   * Create or replace multiple documents at once.
   *
   * @param  {Request} request - Kuzzle API request
   * @param  {boolean} injectKuzzleMeta
   * @return {Promise}
   */
  mcreateOrReplace(request, injectKuzzleMeta = true) {
    let kuzzleMeta = {};

    if (injectKuzzleMeta) {
      kuzzleMeta = {
        _kuzzle_info: {
          active: true,
          author: this._getUserId(request),
          updater: null,
          updatedAt: null,
          deletedAt: null,
          createdAt: Date.now()
        }
      };
    }

    const
      esRequest = initESRequest(request,
        ['consistency', 'refresh', 'timeout', 'fields']),
      extracted = extractMDocuments(request, kuzzleMeta);

    esRequest.body = [];

    for (let i = 0; i < extracted.documents.length; i++) {
      esRequest.body.push({
        index: {
          _index: request.input.resource.index,
          _type: request.input.resource.collection,
          _id: extracted.documents[i]._id
        }
      });
      esRequest.body.push(extracted.documents[i]._source);
    }

    return this._mexecute(esRequest, extracted.documents, extracted.rejected);
  }

  /**
   * Update multiple documents with one request
   * Replacements are rejected if targeted documents do not exist,
   * but documents in the trashcan are silently revived
   * (like with the normal "update" method)
   *
   * @param  {Request} request - Kuzzle API request
   * @return {Promise}
   */
  mupdate(request) {
    const
      esRequest = initESRequest(request,
        ['consistency', 'refresh', 'timeout', 'fields']),
      toImport = [],
      extracted = extractMDocuments(request, {
        _kuzzle_info: {
          active: true,
          updatedAt: Date.now(),
          updater: this._getUserId(request),
          deletedAt: null
        }
      });

    esRequest.body = [];

    for (let i = 0; i < extracted.documents.length; i++) {
      if (typeof extracted.documents[i]._id === 'string') {
        esRequest.body.push({
          update: {
            _index: request.input.resource.index,
            _type: request.input.resource.collection,
            _id: extracted.documents[i]._id
          }
        });

        // _source: true => makes ES return the updated document source in the
        // response. Required by the real-time notifier component
        esRequest.body.push(
          {doc: extracted.documents[i]._source,
            _source: true}
        );
        toImport.push(extracted.documents[i]);
      } else {
        extracted.rejected.push(
          {document: extracted.documents[i],
            reason: 'a document ID is required'}
        );
      }
    }

    return this._mexecute(esRequest, toImport, extracted.rejected)
      .then(response => {
        // with _source: true, ES returns the updated document in
        // response.result.get._source
        // => we replace response.result._source with it so that the notifier
        // module can seamlessly process all kind of m* response*
        for (let j = 0; j < response.result.length; j++) {
          const result = response.result[j];

          if (result.get && result.get._source) {
            result._source = result.get._source;
          }
        }

        return response;
      });
  }

  /**
   * Replace multiple documents at once.
   * Replacements are rejected if targeted documents do not exist,
   * but documents in the trashcan are silently revived
   * (like with the normal "replace" method)
   *
   * @param  {Request} request - Kuzzle API request
   * @return {Promise}
   */
  mreplace(request) {
    const
      index = request.input.resource.index,
      type = request.input.resource.collection,
      toImport = [],
      extracted = extractMDocuments(request, {
        _kuzzle_info: {
          active: true,
          author: this._getUserId(request),
          updater: null,
          updatedAt: null,
          deletedAt: null,
          createdAt: Date.now()
        }
      });

    return this.client.mget(extracted.mgetRequest)
      .then(mgetResult => {
        const esRequest = initESRequest(request,
          ['consistency', 'refresh', 'timeout', 'fields']);
        let idx = 0;

        esRequest.body = [];

        for (let i = 0; i < extracted.documents.length; i++) {
          const document = extracted.documents[i];

          if (typeof document._id === 'string') {
            // document._id should always be equal to mgetResult.docs[idx]._id
            // if the document is not found in ES, then we reject it
            if (mgetResult.docs[idx].found) {
              esRequest.body.push(
                {index:
                  {_index: index,
                    _type: type,
                    _id: document._id}
                });
              esRequest.body.push(document._source);
              toImport.push(document);
            } else {
              extracted.rejected.push(
                {document,
                  reason: 'cannot replace a non-existing document (use mCreateOrReplace if you need to create non-existing documents)'});
            }

            idx++;
          } else {
            extracted.rejected.push(
              {document,
                reason: 'a document ID is required'}
            );
          }
        }

        return this._mexecute(esRequest, toImport, extracted.rejected);
      });
  }

  /**
   * Delete multiple documents with one request
   *
   * @param  {Request} request - Kuzzle API request
   * @return {Promise}
   */
  mdelete(request) {
    const
      esRequest = initESRequest(request,
        ['consistency', 'refresh', 'timeout', 'fields']),
      {
        index,
        collection
      } = request.input.resource,
      ids = [],
      partialErrors = [],
      metadata = {
        _kuzzle_info: {
          active: false,
          deletedAt: Date.now(),
          updater: this._getUserId(request)
        }
      };

    esRequest.body = [];

    for (let i = 0; i < request.input.body.ids.length; i++) {
      const id = request.input.body.ids[i];

      if (typeof id === 'string') {
        esRequest.body.push(
          {update:
            {_index: index,
              _type: collection,
              _id: id}
          });
        esRequest.body.push({doc: metadata});
        ids.push([{_id: id}]);
      } else {
        partialErrors.push({id, reason: 'the document ID must be a string'});
      }
    }

    return this._mexecute(esRequest, ids, partialErrors)
      .then(response => {
        response.result = response.result.map(doc => doc._id);
        return response;
      });
  }

  /**
   * This method can be called either:
   *  - at the first creation of a collection : we need to apply the index default mapping
   *  - when a collection mapping is updated : we need to protect the index common mapping
   */
  _mergeDefaultMapping (index, oldMapping, newMapping) {
    const collectionMapping = {};
    const commonMapping = _.cloneDeep(
      this.kuzzle.indexCache.defaultMappings[index] ||
      this.config.commonMapping
    );

    collectionMapping.dynamic = newMapping.dynamic ||
    oldMapping.dynamic ||
    this.config.dynamic;
    collectionMapping._meta = newMapping._meta || oldMapping._meta || {};

    // Preserve old version of kuzzle metadata mapping
    if (oldMapping.properties && oldMapping.properties._kuzzle_info) {
      Object.assign(
        commonMapping._kuzzle_info.properties,
        oldMapping.properties._kuzzle_info.properties
      );
    }

    collectionMapping.properties = Object.assign({},
      newMapping.properties,
      commonMapping
    );

    return collectionMapping;
  }

  /**
   * Execute an ES request prepared by mcreate, mupdate, mreplace, mdelete or mwriteDocuments
   * Returns a standardized ES response object, containing the list of
   * successfully performed operations, and the rejected ones
   *
   * @param  {Object} esRequest    - Elasticsearch request
   * @param  {Array} documents     - Document sources (format: {_id, _source})
   * @param  {Array} partialErrors - pre-rejected documents
   * @return {Promise}
   */
  _mexecute(esRequest, documents, partialErrors) {
    assertWellFormedRefresh(esRequest);

    return this.kuzzle.indexCache.exists(index, collection)
      .then(exists => {
        if (! exists) {
          this.throw(
            'index_or_collection_does_not_exist',
            esRequest.index,
            collection
          );
        }

        if (documents.length > this.kuzzle.config.limits.documentsWriteCount) {
          this.throw(
            'limit_documents_reached',
            this.kuzzle.config.limits.documentsWriteCount
          );
        }

        return documents.length > 0 ?
          this.client.bulk(esRequest) :
          Bluebird.resolve({items: []});
      })
      .then(result => {
        const successes = [];

        for (let i = 0; i < result.items.length; i++) {
          const item = result.items[i][Object.keys(result.items[i])[0]];

          if (item.status >= 400) {
            partialErrors.push(
              prepareMetadata(Object.assign({}, documents[i], item)));
          } else {
            successes.push(
              prepareMetadata(Object.assign({}, documents[i], item)));
          }
        }

        return {result: successes, error: partialErrors};
      })
      .catch(err => Bluebird.reject(this.esWrapper.formatESError(err)));
  }

  _getUserId (request) {
    if (request.context.user && request.context.user._id) {
      return String(request.context.user._id);
    }

    return null;
  }

  _checkMapping (mapping, path = [], check = true) {
    const
      properties = Object.keys(mapping),
      mappingProperties = path.length === 0
        ? rootMappingProperties
        : [...rootMappingProperties, ...childMappingProperties];

    for (const property of properties) {
      if (check && !mappingProperties.includes(property)) {
        const currentPath = [...path, property].join('.');

        this.throw(
          'incorrect_mapping_property',
          currentPath,
          didYouMean(property, mappingProperties));
      }

      if (property === 'properties') {
        // type definition level, we don't check
        this._checkMapping(mapping[property], [...path, 'properties'], false);
      } else if (mapping[property].properties) {
        // root properties level, check for "properties", "dynamic" and "_meta"
        this._checkMapping(mapping[property], [...path, property], true);
      }
    }
  }

  _extractIndexes (esIndexes, { internal=false } = {}) {
    const
      indexes = new Set(),
      prefix = internal
        ? INTERNAL_PREFIX
        : USER_PREFIX;

    for (const esIndex of esIndexes) {
      if (esIndex[0] === prefix) {
        indexes.add(extractIndex(esIndex));
      }
    }

    return Array.from(indexes);
  }

  /**
   * Returns a new elasticsearch client instance
   *
   * @returns {object}
   */
  _buildClient () {
    // Passed to Elasticsearch's client to make it use
    // Bluebird instead of ES6 promises
    const defer = function defer () {
      let
        resolve,
        reject;

      const promise = new Bluebird((res, rej) => {
        resolve = res;
        reject = rej;
      });

      return { resolve, reject, promise };
    };

    return new ESClient(Object.assign({ defer }, this.config.client));
  }

  /**
   * Get the name of an esIndex for an index + collection
   *
   * @param {string} index
   * @param {string} collection
   *
   * @returns {string} esIndex name (eg: '&nepali#liia')
   */
  _getESIndex (index, collection) {
    if (! index || ! collection) {
      return null;
    }

    const prefix = this.internal
      ? INTERNAL_PREFIX
      : USER_PREFIX;

    return `${prefix}${index}${NAME_SEPARATOR}${collection}`;
  }

  /**
   * Remove depth in object (replace hits.hits<array>, with hits<array>)
   *
   * @param result
   * @returns {object}
   */
  _formatSearchResults (result) {
    const formattedResult = result.hits
      ? { ...result, ...result.hits }
      : result;

    return formattedResult;
  }

  /**
   * Triggers an refresh call on the esIndex if the autoRefresh is on.
   * Else, passes the response through.
   *
   * @this ElasticSearch
   * @param {string} esIndex - ES index name (eg: '&nepali#liia')
   * @param {object} apiResponse - API response
   * @returns {Promise}
   */
  _refreshESIndexIfNeeded(esIndex, apiResponse) {
    if (! this.settings.autoRefresh[esIndex]) {
      return Bluebird.resolve(apiResponse);
    }

    return this.client.indices.refresh({ index: esIndex })
      .then(() => apiResponse)
      .catch(error => {
        // index refresh failures are non-blocking
        this.kuzzle.log.error(
          this.getError(
            'error_on_index_refresh',
            esRequest.index,
            error.message)
        );

        return apiResponse;
      });
  }
  /**
   * Scroll index in elasticsearch and return all document ids that match the filter
   *
   * @param {object} esRequest
   * @returns {Promise} resolve to an array of documents IDs
   */
  _fetchIds(esRequest) {
    const ids = [];

    return new Bluebird((resolve, reject) => {
      this.client.search(esRequest, function getMoreUntilDone(error, response) {
        if (error) {
          return reject(error);
        }

        response.hits.hits.forEach(hit => ids.push(hit._id));

        if (response.hits.total !== ids.length) {
          this.client.scroll({
            scrollId: response._scroll_id,
            scroll: esRequest.scroll
          }, getMoreUntilDone);
        }
        else {
          resolve(ids);
        }
      });
    });
  }

}

module.exports = ElasticSearch;

/**
 * Add filter to get only the active documents
 * @param {object} esRequest
 * @return {object} modified filter
 */
function addActiveFilter(esRequest) {
  const
    queryObject = {
      bool: {
        filter: {
          bool: {
            must_not: {
              term: {
                '_kuzzle_info.active': false
              }
            }
          }
        }
      }
    };

  if (esRequest.body && esRequest.body.query) {
    queryObject.bool.must = esRequest.body.query;
    esRequest.body.query = queryObject;
  }
  else if (esRequest.body) {
    esRequest.body.query = queryObject;
  }
  else {
    esRequest.body = {
      query: queryObject
    };
  }

  return esRequest;
}

/**
 * Copy _kuzzle_info to root attribute _meta
 * This behavior will be deprecated
 *
 * @param response
 * @return {object}
 */
function prepareMetadata(response) {
  if (response._source && response._source._kuzzle_info) {
    response._meta = response._source._kuzzle_info;
  }

  return response;
}

/**
 * Forbid the use of the _routing ES option
 * @param {object} esRequest
 * @throws
 */
function assertNoRouting(esRequest) {
  if (esRequest.body._routing) {
    errorsManager.throw(
      'external',
      'elasticsearch',
      'create_action_does_not_support_routing'
    );
  }
}

/**
 * Checks if the optional "refresh" argument is well-formed
 *
 * @param {object} esRequest
 * @throws
 */
function assertWellFormedRefresh(esRequest) {
  if (
    _.has(esRequest, 'refresh')
    && ['wait_for', 'false', false].indexOf(esRequest.refresh) < 0
  ) {
    errorsManager.throw('external', 'elasticsearch', 'wrong_refresh_parameter');
  }
}

/**
 * Extract, inject metadata and validate documents contained
 * in a Request
 *
 * Used by mcreate, mupdate, mreplace and mcreateOrReplace
 *
 * @param  {Request} request - Kuzzle API request
 * @param  {Object} metadata
 * @return {Object}
 */
function extractMDocuments(request, metadata) {
  const result = {
    rejected: [],
    documents: [],
    mgetRequest: {
      index: request.input.resource.index,
      type: request.input.resource.collection,
      body: {
        docs: []
      }
    }
  };

  for (let i = 0; i < request.input.body.documents.length; i++) {
    const document = request.input.body.documents[i];

    if (typeof document.body === 'object' &&
    document.body !== null &&
    !Array.isArray(document.body)) {
      result.documents.push({
        _id: document._id,
        _source: Object.assign({}, metadata, document.body)
      });

      if (typeof document._id === 'string') {
        result.mgetRequest.body.docs.push(
          {_id: document._id,
            _source: '_kuzzle_info.active'}
        );
      }
    } else {
      result.rejected.push({document, reason: 'bad format'});
    }
  }

  return result;
}
