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
  PUBLIC_PREFIX = '&',
  NAME_SEPARATOR = '.';

/**
 * @param {Kuzzle} kuzzle kuzzle instance
 * @param {Object} config Service configuration
 * @param {String} indexType - "internal" or "public" (default "public")
 * @constructor
 */
class ElasticSearch extends Service {
  constructor(kuzzle, config, indexType = 'public') {
    super('elasticsearch');

    this.kuzzle = kuzzle;
    this.indexPrefix = indexType === 'internal'
      ? INTERNAL_PREFIX
      : PUBLIC_PREFIX;
    this.config = config;

    this.client = null;
    this.esWrapper = null;
    this.esVersion = null;
  }

  /**
   * Initializes the elasticsearch client
   *
   * @returns {Promise.<Object>}
   */
  init () {
    if (this.client) {
      return Bluebird.resolve(this);
    }

    if (process.env.NODE_ENV === 'production' && this.config.dynamic === 'true') {
      this.kuzzle.log.warn('Your dynamic mapping policy is set to \'true\' for new fields.\nElasticsearch will try to automatically infer mapping for new fields, and those cannot be changed afterward.\nSee the "services.db.dynamic" option in the kuzzlerc configuration file to change this value.');
    }

    this.client = this._buildClient();
    this.esWrapper = new ESWrapper(this.client);

    return this.client.info()
      .then(({ body }) => {
        this.esVersion = body.version;

        if (this.esVersion && !semver.satisfies(this.esVersion.number, '>= 7.0.0')) {
          this.throw('wrong_elasticsearch_version', this.esVersion.number);
        }

        return this;
      });
  }

  /**
   * Returns some basic information about this service
   *
   * @returns {Promise.<Object>} service informations
   */
  getInfos () {
    const result = {
      type: 'elasticsearch'
    };

    return this.client.info()
      .then(({ body }) => {
        result.version = body.version.number;
        result.lucene = body.version.lucene_version;

        return this.client.cluster.health();
      })
      .then(({ body }) => {
        result.status = body.status;
        result.nodes = body.number_of_nodes;

        return this.client.cluster.stats({ human: true });
      })
      .then(({ body }) => {
        result.spaceUsed = body.indices.store.size;
        result.nodes = body.nodes;

        return result;
      })
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Scrolls results from previous elasticsearch query
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} scrollId - Scroll identifier
   * @param {Object} options - scroll (default scrollTTL)
   *
   * @returns {Promise.<Object>} { scrollId, hits, total }
   */
  scroll (
    index,
    collection,
    scrollId,
    { scroll=this.config.defaults.scrollTTL } = {})
  {
    const esRequest = {
      index: this._getESIndex(index, collection),
      scroll,
      scrollId
    };

    const cacheKey = scrollCachePrefix + this.kuzzle.constructor.hash(
      esRequest.scrollId);

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
      .then(({ body }) => ({
        scrollId: body.scrollId,
        hits: body.hits,
        total: body.total
      }))
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Searches documents from elasticsearch with a query
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} searchBody - Search request body (query, sort, etc.)
   * @param {Object} options - from (null), size (null), scroll (null)
   *
   * @returns {Promise.<Object>} { scrollId, hits, aggregations, total }
   */
  search (
    index,
    collection,
    searchBody,
    { from=null, size=null, scroll=null } = {})
  {
    const esRequest = {
      index: this._getESIndex(index, collection),
      body: searchBody,
      from,
      size,
      scroll
    };

    return this.client.search(esRequest)
      .then(({ body }) => {
        if (body.scrollId) {
          const
            // ms(scroll) may return undefined if in microseconds or in nanoseconds
            ttl = esRequest.scroll && ms(esRequest.scroll)
              || ms(this.config.defaults.scrollTTL),
            key = scrollCachePrefix + this.kuzzle.constructor.hash(
              body.scrollId
            );

          return this.kuzzle.services.list.internalCache.psetex(key, ttl, 0)
            .then(() => body);
        }

        return {
          scrollId: body.scrollId,
          hits: body.hits,
          aggregations: body.aggregations,
          total: body.total
        };
      })
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Gets the document with given ID
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document ID
   *
   * @returns {Promise.<Object>} { _id, _version, _source }
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
      .then(({ body }) => ({
        _id: body._id,
        _version: body._version,
        _source: body._source
      }))
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Returns the list of documents matching the ids given in the body param
   * NB: Due to internal Kuzzle mechanism, can only be called on a single index/collection,
   * using the body { ids: [.. } syntax.
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Array.<String>} ids - Document IDs
   *
   * @returns {Promise.<Object>} { result: { _id, _source, _version }, errors: { _id } }
   */
  mGet (index, collection, ids) {
    const
      esIndex = this._getESIndex(index, collection),
      esRequest = {
        body: { docs: [] }
      };

    for (const _id of ids) {
      esRequest.body.docs.push({
        _index: esIndex,
        _id
      });
    }

    return this.client.mget(esRequest)
      .then(({ body }) => {
        const
          errors = [],
          result = [];

        for (const doc of body.docs) {
          if (doc.found) {
            result.push({
              _id: doc._id,
              _source: doc._source,
              _version: doc._version
            });
          }
          else {
            errors.push({
              _id: doc._id
            });
          }
        }

        return {
          result,
          errors
        };
      })
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Counts how many documents match the filter given in body
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} query - Query to match
   *
   * @returns {Promise.<Object>} { count }
   */
  count (index, collection, query = {}) {
    const esRequest = {
      index: this._getESIndex(index, collection),
      body: query
    };

    return this.client.count(esRequest)
      .then(({ body }) => ({
        count: body.count
      }))
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Sends the new document to elasticsearch
   * Cleans data to match elasticsearch specifications
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} content - Document content
   * @param {Object} options - id (null), refresh (false), userId (null)
   *
   * @returns {Promise.<Object>} { _id, _version, _source }
   */
  create (
    index,
    collection,
    content,
    { id=null, refresh=false, userId=null } = {})
  {
    assertIsObject(content);

    const esRequest = {
      index: this._getESIndex(index, collection),
      body: content,
      op_type: 'create',
      id,
      refresh
    };

    assertNoRouting(esRequest);
    assertWellFormedRefresh(esRequest);

    // Add metadata
    esRequest.body._kuzzle_info = {
      author: getUserId(userId),
      createdAt: Date.now(),
      updatedAt: null,
      updater: null
    };

    return this.client.index(esRequest)
      .then(({ body }) => ({
        _id: body._id,
        _version: body._version,
        _source: esRequest.body
      }))
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Creates a new document to ElasticSearch, or replace it if it already exist
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Object} content - Document content
   * @param {Object} options - refresh (false), userId (null), injectKuzzleMeta (true)
   *
   * @returns {Promise.<Object>} { _id, _version, _source, created }
   */
  createOrReplace (
    index,
    collection,
    id,
    content,
    { refresh=false, userId=null, injectKuzzleMeta=true } = {})
  {
    const esRequest = {
      index: this._getESIndex(index, collection),
      body: content,
      id,
      refresh
    };

    assertNoRouting(esRequest);
    assertWellFormedRefresh(esRequest);

    // Add metadata
    if (injectKuzzleMeta) {
      esRequest.body._kuzzle_info = {
        author: getUserId(userId),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updater: getUserId(userId)
      };
    }

    return this.client.index(esRequest)
      .then(({ body }) => ({
        _id: body._id,
        _version: body._version,
        _source: esRequest.body,
        created: body.created
      }))
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Sends the partial document to elasticsearch with the id to update
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Object} content - Updated content
   * @param {Object} options - refresh (false), userId (null), retryOnConflict (0)
   *
   * @returns {Promise.<Object>} { _id, _version }
   */
  update (
    index,
    collection,
    id,
    content,
    { refresh=false, userId=null, retryOnConflict=this.config.defaults.onUpdateConflictRetries } = {})
  {
    const esRequest = {
      index: this._getESIndex(index, collection),
      body: { doc: content },
      id,
      refresh,
      retryOnConflict
    };

    assertNoRouting(esRequest);
    assertWellFormedRefresh(esRequest);

    // Add metadata
    esRequest.body.doc._kuzzle_info = {
      updatedAt: Date.now(),
      updater: getUserId(userId)
    };

    return this.client.update(esRequest)
      .then(({ body }) => ({
        _id: body._id,
        _version: body._version
      }))
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Replaces a document to ElasticSearch
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Object} content - Document content
   * @param {Object} options - refresh (false), userId (null)
   *
   * @returns {Promise.<Object>} { _id, _version, _source }
   */
  replace (
    index,
    collection,
    id,
    content,
    { refresh=false, userId=null } = {})
  {
    const
      esIndex = this._getESIndex(index, collection),
      esRequest = {
        index: esIndex,
        body: content,
        id,
        refresh
      };

    assertNoRouting(esRequest);
    assertWellFormedRefresh(esRequest);

    // Add metadata
    esRequest.body._kuzzle_info = {
      author: getUserId(userId),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      updater: getUserId(userId)
    };

    return this.client.exists({ index: esIndex, id })
      .then(({ body: exists }) => {
        if (! exists) {
          this.throw('document_not_found', id);
        }

        return this.client.index(esRequest);
      })
      .then(({ body }) => ({
        _id: id,
        _version: body._version,
        _source: esRequest.body
      }))
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Sends to elasticsearch the document id to delete
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Object} options - refresh (false), retryOnConflict (-1)
   *
   * @returns {Promise}
   */
  delete (
    index,
    collection,
    id,
    { refresh=false, retryOnConflict=this.config.defaults.onUpdateConflictRetries } = {})
  {
    const esRequest = {
      index: this._getESIndex(index, collection),
      id,
      refresh,
      retryOnConflict
    };

    assertWellFormedRefresh(esRequest);

    return this.client.delete(esRequest)
      .then(() => {
        // return nothing
      })
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Deletes all documents matching the provided filters
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} query - Query to match documents
   * @param {Object} options - from (null), size (null), refresh (false)
   *
   * @returns {Promise.<Object>} { total, deleted, failures: { _shardId, reason } }
   */
  deleteByQuery (
    index,
    collection,
    query,
    { refresh=false, from=null, size=null } = {})
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

    return this.client.deleteByQuery(esRequest)
      .then(({ body }) => ({
        total: body.total,
        deleted: body.deleted,
        failures:
          body.failures.map(({ shardId, reason }) => ({
            shardId,
            reason
          }))
      }))
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Creates a new index.
   *
   * This methods does not create an index because they don't exists physicaly
   * inside Elasticsearch since each collection is an Elastic index.
   * This methods resolves if the index name does not already exists either as
   * internal or public index.
   *
   * @param {String} index - Index name
   *
   * @returns {Promise}
   */
  createIndex (index) {
    return this.client.cat.indices({ format: 'json' })
      .then(({ body }) => {
        const esIndexes = body.map(({ index: name }) => name);

        for (const esIndex of esIndexes) {
          const indexName = this._extractIndex(esIndex);

          if (index === indexName) {
            const internalMessage = esIndex[0] === INTERNAL_PREFIX
              ? ' Index is used internaly by Kuzzle.'
              : '';

            this.throw('index_already_exists', index, internalMessage);
          }
        }
      })
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Creates an empty collection. Mapping will be applied if supplied.
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} mappings - Collection mappings in ES format
   *
   * @returns {Promise}
   */
  createCollection (index, collection, mappings = {}) {
    const esRequest = {
      index: this._getESIndex(index, collection),
      body: { mappings: _.merge(mappings, this.config.commonMapping) }
    };

    return this.collectionExists(index, collection)
      .then(exists => {
        if (exists) {
          return this.updateMapping(index, collection, mappings);
        }

        this._checkMappings(esRequest.body.mappings);

        return this.client.indices.create(esRequest)
          .then(() => {
            // return nothing
          })
          .catch(error => this.esWrapper.reject(error));
      });
  }

  /**
   * Retrieves mapping definition for index/type
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} options - includeKuzzleMeta (false)
   *
   * @return {Promise.<Object>} { dynamic, _meta, properties }
   */
  getMapping (index, collection, { includeKuzzleMeta=false } = {}) {
    const
      esIndex = this._getESIndex(index, collection),
      esRequest = {
        index: esIndex
      };

    return this.client.indices.getMapping(esRequest)
      .then(({ body }) => {
        const properties = includeKuzzleMeta
          ? body[esIndex].mappings.properties
          : _.omit(body[esIndex].mappings.properties, '_kuzzle_info');

        return {
          dynamic: body[esIndex].mappings.dynamic,
          _meta: body[esIndex].mappings._meta,
          properties
        };
      })
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Adds a mapping definition to a specific type
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} mappings - Collection mappings in ES format
   *
   * @return {Promise.<Object>} { dynamic, _meta, properties }
   */
  updateMapping (index, collection, mappings = {}) {
    const esRequest = {
      index: this._getESIndex(index, collection)
    };

    let fullProperties;

    return this.getMapping(index, collection, true)
      .then(collectionMappings => {

        this._checkMappings(mappings);

        esRequest.body = {
          dynamic: mappings.dynamic || collectionMappings.dynamic,
          _meta: mappings._meta || collectionMappings._meta,
          properties: mappings.properties
        };

        fullProperties = _.merge(collectionMappings.properties, mappings.properties);

        return this.client.indices.putMapping(esRequest);
      })
      .then(() => ({
        dynamic: esRequest.body.dynamic,
        _meta: esRequest.body._meta,
        properties: fullProperties
      }))
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Empties the content of a collection. Keep the existing mapping.
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   *
   * @returns {Promise}
   */
  truncateCollection (index, collection) {
    let mappings;

    const esRequest = {
      index: this._getESIndex(index, collection)
    };

    return this.getMapping(index, collection)
      .then(collectionMappings => {
        mappings = collectionMappings;

        return this.client.indices.delete(esRequest);
      })
      .then(() => this.client.indices.create({ ...esRequest, mappings }))
      .then(() => {
        // return nothing
      })
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Runs several action and document
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Array.<Object>} documents - Documents to import
   * @param {Object} options - timeout (null), refresh (false), userId (null)
   *
   * @returns {Promise.<Object>} { items, errors }
   */
  import (
    index,
    collection,
    documents,
    { refresh=false, timeout=null, userId=null } = {})
  {
    const
      esIndex = this._getESIndex(index, collection),
      actionNames = ['index', 'create', 'update', 'delete'],
      dateNow = Date.now(),
      esRequest = {
        body: documents,
        refresh,
        timeout
      },
      kuzzleMeta = {
        created: {
          author: getUserId(userId),
          createdAt: dateNow,
          updatedAt: null,
          updater: null
        },
        updated: {
          updater: getUserId(userId),
          updatedAt: dateNow
        }
      };

    assertWellFormedRefresh(esRequest);

    let
      actionCount = 0,
      lastAction; // NOSONAR

    for (let i = 0; i < esRequest.body.length; i++) {
      const
        item = esRequest.body[i],
        action = Object.keys(item)[0];

      if (actionNames.includes(action)) {
        lastAction = action;
        actionCount++;

        item[action]._index = esIndex;

        if (item[action]._type) {
          delete item[action]._type;
        }
      }
      else if (lastAction === 'index' || lastAction === 'create') {
        item._kuzzle_info = kuzzleMeta.created;
      }
      else if (lastAction === 'update') {
        // we can only update metadata on a partial update, or on an upsert
        for (const prop of ['doc', 'upsert']) {
          if (_.isPlainObject(item[prop])) {
            item[prop]._kuzzle_info = kuzzleMeta.updated;
          }
        }
      }
    }

    if (actionCount > this.kuzzle.config.limits.documentsWriteCount) {
      return this.reject(
        'limit_documents_reached',
        this.kuzzle.config.limits.documentsWriteCount);
    }

    return this.client.bulk(esRequest)
      .then(({ body }) => {
        const result = {
          items: [],
          errors: []
        };

        let row;

        while ((row = body.items.shift()) !== undefined) {
          const
            action = Object.keys(row)[0],
            item = row[action];

          if (item.status >= 400) {
            item.action = action;

            result.errors.push({
              [action]: {
                status: item.status,
                _id: item._id,
                error: {
                  type: item.error.type,
                  reason: item.error.reason
                }
              }
            });
          }
          else {
            result.items.push({
              [action]: {
                status: item.status,
                _id: item._id,
                result: item.result
              }
            });
          }
        }

        return result;
      })
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Retrieves the complete list of existing collections in the current index
   *
   * @param {String} index - Index name
   *
   * @return {Promise.<Object>} { collections }
   */
  listCollections (index) {
    return this.client.cat.indices({ format: 'json' })
      .then(({ body }) => {
        const
          esIndexes = body.map(({ index: esIndex }) => esIndex),
          collections = this._extractCollections(esIndexes, index);

        return {
          collections
        };
      })
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Retrieves the complete list of indexes
   *
   * @returns {Promise.<Object>} { indexes }
   */
  listIndexes () {
    return this.client.cat.indices({ format: 'json' })
      .then(({ body }) => {
        const
          esIndexes = body.map(({ index }) => index),
          indexes = this._extractIndexes(esIndexes);

        return {
          indexes
        };
      })
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Resets all indexes that the users is allowed to delete
   *
   * @param {String} indexes - Index names
   *
   * @return {Promise.<Object>} { deleted }
   */
  deleteIndexes (indexes) {
    const deleted = new Set();

    return this.client.cat.indices({ format: 'json' })
      .then(({ body }) => {
        const
          esIndexes = body
            .map(({ index }) => index)
            .filter(esIndex => {
              const index = this._extractIndex(esIndex);

              if (esIndex[0] !== this.indexPrefix || ! indexes.includes(index)) {
                return false;
              }

              deleted.add(index);

              return true;
            }),
          esRequest = {
            index: esIndexes
          };

        return this.client.indices.delete(esRequest);
      })
      .then(() => ({
        deleted: Array.from(deleted)
      }))
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Deletes an index
   *
   * @param {String} index - Index name
   *
   * @returns {Promise}
   */
  deleteIndex (index) {
    return this.deleteIndexes([index])
      .then(() => {
        // return nothing
      });
  }

  /**
   * Forces a refresh on the collection.
   *
   * /!\ Can lead to some performance issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html for more details
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   *
   * @returns {Promise.<Object>} { _shards }
   */
  refreshCollection (index, collection) {
    const esRequest = {
      index: this._getESIndex(index, collection)
    };

    return this.client.indices.refresh(esRequest)
      .then(({ body}) => ({
        _shards: body._shards
      }))
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Returns true if the document exists
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document ID
   *
   * @returns {Promise.<boolean>}
   */
  exists (index, collection, id) {
    const esRequest = {
      index: this._getESIndex(index, collection),
      id
    };

    return this.client.exists(esRequest)
      .then(({ body }) => body)
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Returns true if the index exists
   *
   * @param {String} index - Index name
   *
   * @returns {Promise.<boolean>}
   */
  indexExists (index) {
    return this.listIndexes()
      .then(({ indexes }) => indexes.some(idx => idx === index));
  }

  /**
   * Returns true if the collection exists
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   *
   * @returns {Promise.<boolean>}
   */
  collectionExists (index, collection) {
    return this.listCollections(index)
      .then(({ collections }) => collections.some(col => col === collection));
  }

  /**
   * Creates multiple documents at once.
   * If a content has no id, one is automatically generated and assigned to it.
   * If a content has a specified identifier, it is rejected if it already exists
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Array.<Object>} documents - Documents
   * @param {Object} options - timeout (null), refresh (false), userId (null)
   *
   * @return {Promise.<Object>} { result, errors }
   */
  mCreate (
    index,
    collection,
    documents,
    { refresh=false, timeout=null, userId=null } = {})
  {
    const
      esIndex = this._getESIndex(index, collection),
      kuzzleMeta = {
        _kuzzle_info: {
          author: getUserId(userId),
          createdAt: Date.now(),
          updater: null,
          updatedAt: null
        }
      },
      {
        rejected,
        extractedDocuments,
        documentsToGet
      } = this._extractMDocuments(documents, kuzzleMeta, { prepareMGet: true });

    // prepare the mget request, but only for document having a specified id
    let mGetRequest;

    if (documentsToGet.length > 0) {
      mGetRequest =
        this.client.mget({ index: esIndex, body: { docs: documentsToGet }});
    } else {
      mGetRequest = Bluebird.resolve({ body: { docs: [] } });
    }

    return mGetRequest
      .then(({ body }) => {
        const
          existingDocuments = body.docs,
          esRequest = {
            index: esIndex,
            body: [],
            refresh,
            timeout
          },
          toImport = [];

        let idx = 0;

        for (let i = 0; i < extractedDocuments.length; i++) {
          const document = extractedDocuments[i];

          // Documents are retrieved in the same order than we got them from user
          if (typeof document._id === 'string'
            && existingDocuments[idx]
            && existingDocuments[idx].found
          ) {
            rejected.push({
              document,
              reason: 'document already exists'
            });

            idx++;
          } else if (typeof document._id === 'string'
            && existingDocuments[idx]
            && ! existingDocuments[idx].found
          ) {
            esRequest.body.push({
              index: {
                _index: esIndex,
                _id: document._id
              }
            });
            esRequest.body.push(document._source);

            toImport.push(document);
          } else {
            esRequest.body.push({ index: { _index: esIndex } });
            esRequest.body.push(document._source);

            toImport.push(document);
          }
        }

        return this._mExecute(esRequest, toImport, rejected);
      });
  }

  /**
   * Creates or replaces multiple documents at once.
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Array.<Object>} documents - Documents
   * @param {Object} options - timeout (null), refresh (false), userId (null), injectKuzzleMeta (false)
   *
   * @return {Promise.<Object>} { result, errors }
   */
  mCreateOrReplace(
    index,
    collection,
    documents,
    { refresh=false, timeout=null, userId=null, injectKuzzleMeta=true } = {})
  {
    let kuzzleMeta = {};

    if (injectKuzzleMeta) {
      kuzzleMeta = {
        _kuzzle_info: {
          author: getUserId(userId),
          createdAt: Date.now(),
          updater: null,
          updatedAt: null
        }
      };
    }

    const
      esIndex = this._getESIndex(index, collection),
      esRequest = {
        index: esIndex,
        body: [],
        refresh,
        timeout
      },
      {
        rejected,
        extractedDocuments
      } = this._extractMDocuments(documents, kuzzleMeta);

    esRequest.body = [];

    for (let i = 0; i < extractedDocuments.length; i++) {
      esRequest.body.push({
        index: {
          _index: esIndex,
          _id: extractedDocuments[i]._id
        }
      });
      esRequest.body.push(extractedDocuments[i]._source);
    }

    return this._mExecute(esRequest, extractedDocuments, rejected);
  }

  /**
   * Updates multiple documents with one request
   * Replacements are rejected if targeted documents do not exist
   * (like with the normal "update" method)
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Array.<Object>} documents - Documents
   * @param {Object} options - timeout (null), refresh (false), userId (null)
   *
   * @return {Promise.<Object>} { result, errors }
   */
  mUpdate (
    index,
    collection,
    documents,
    { refresh=false, timeout=null, userId=null } = {})
  {
    const
      esIndex = this._getESIndex(index, collection),
      toImport = [],
      esRequest = {
        index: esIndex,
        body: [],
        refresh,
        timeout
      },
      kuzzleMeta = {
        _kuzzle_info: {
          updatedAt: Date.now(),
          updater: getUserId(userId)
        }
      },
      {
        rejected,
        extractedDocuments
      } = this._extractMDocuments(documents, kuzzleMeta);

    for (let i = 0; i < extractedDocuments.length; i++) {
      if (typeof extractedDocuments[i]._id === 'string') {
        esRequest.body.push({
          update: {
            _index: esIndex,
            _id: extractedDocuments[i]._id
          }
        });

        // _source: true => makes ES return the updated document source in the
        // response. Required by the real-time notifier component
        esRequest.body.push({
          doc: extractedDocuments[i]._source,
          _source: true
        });
        toImport.push(extractedDocuments[i]);
      } else {
        rejected.push({
          document: extractedDocuments[i],
          reason: 'document ID is required'
        });
      }
    }

    return this._mExecute(esRequest, toImport, rejected)
      .then(response => {
        const results = [];

        // with _source: true, ES returns the updated document in
        // response.result.get._source
        // => we replace response.result._source with it so that the notifier
        // module can seamlessly process all kind of m* response*
        for (let i = 0; i < response.result.length; i++) {
          results.push({
            _id: response.result[i]._id,
            _source: response.result[i].get._source
          });
        }

        response.result = results;

        return response;
      });
  }

  /**
   * Replaces multiple documents at once.
   * Replacements are rejected if targeted documents do not exist
   * (like with the normal "replace" method)
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Array.<Object>} documents - Documents
   * @param {Object} options - timeout (null), refresh (false), userId (null)
   *
   * @return {Promise.<Object>} { result, errors }
   */
  mReplace (
    index,
    collection,
    documents,
    { refresh=false, timeout=null, userId=null } = {})
  {
    const
      esIndex = this._getESIndex(index, collection),
      kuzzleMeta = {
        _kuzzle_info: {
          author: getUserId(userId),
          createdAt: Date.now(),
          updater: null,
          updatedAt: null
        }
      },
      {
        rejected,
        extractedDocuments,
        documentsToGet
      } = this._extractMDocuments(documents, kuzzleMeta, { prepareMGet: true });

    return this.client.mget({ index: esIndex, body: { docs: documentsToGet }})
      .then(({ body }) => {
        const
          existingDocuments = body.docs,
          esRequest = {
            body: [],
            refresh,
            timeout
          },
          toImport = [];

        let idx = 0;

        for (let i = 0; i < extractedDocuments.length; i++) {
          const document = extractedDocuments[i];

          if (typeof document._id === 'string') {
            // Documents are retrieved in the same order than we got them from user
            if (existingDocuments[idx] && existingDocuments[idx].found) {
              esRequest.body.push({
                index: {
                  _index: esIndex,
                  _id: document._id
                }
              });
              esRequest.body.push(document._source);

              toImport.push(document);

              idx++;
            } else {
              rejected.push({
                document,
                reason: 'cannot replace a non-existing document (use mCreateOrReplace if you need to create non-existing documents)'
              });
            }
          } else {
            rejected.push({
              document,
              reason: 'the document ID must be a string'
            });
          }
        }

        return this._mExecute(esRequest, toImport, rejected);
      });
  }

  /**
   * Deletes multiple documents with one request
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Array.<String>} documents - Documents IDs
   * @param {Object} options - timeout (null), refresh (false)
   *
   * @return {Promise.<Object>} { result, errors }
   */
  mDelete (
    index,
    collection,
    ids,
    { refresh=false, timeout=null } = {})
  {
    const
      esRequest = {
        index: this._getESIndex(index, collection),
        body: { ids: { values: [] } },
        scroll: '30s',
        refresh,
        timeout
      },
      toGet = [],
      toDelete = [],
      partialErrors = [];

    if (ids.length > this.kuzzle.config.limits.documentsWriteCount) {
      return this.reject(
        'limit_documents_reached',
        this.kuzzle.config.limits.documentsWriteCount);
    }

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];

      if (typeof id === 'string') {
        toGet.push(id);
      } else {
        partialErrors.push({ id, reason: 'the document ID must be a string' });
      }
    }

    return this.mGet(index, collection, toDelete)
      .then(({ hits }) => {
        let idx = 0;

        for (let i = 0; i < ids.length; i++) {
          const
            id = ids[i],
            hit = hits[idx];

          if (hit && hit._id === id) {
            toDelete.push(id);
            idx++;
          } else {
            partialErrors.push({ id, reason: 'cannot find document' });
          }
        }

        esRequest.body.ids.values = toDelete;

        return this.client.deleteByQuery(esRequest);
      })
      .then(() => ({
        result: toDelete,
        errors: partialErrors
      }))
      .catch(error => this.esWrapper.reject(error));
  }

  /**
   * Executes an ES request prepared by mcreate, mupdate, mreplace, mdelete or mwriteDocuments
   * Returns a standardized ES response object, containing the list of
   * successfully performed operations, and the rejected ones
   *
   * @param  {Object} esRequest    - Elasticsearch request
   * @param  {Array.<Object>} documents     - Document sources (format: {_id, _source})
   * @param  {Array.<Object>} partialErrors - pre-rejected documents
   *
   * @return {Promise.<Object>} { result, errors }
   */
  _mExecute(esRequest, documents, partialErrors) {
    assertWellFormedRefresh(esRequest);

    if (documents.length > this.kuzzle.config.limits.documentsWriteCount) {
      return this.reject(
        'limit_documents_reached',
        this.kuzzle.config.limits.documentsWriteCount);
    }

    const promise = documents.length > 0
      ? this.client.bulk(esRequest)
      : Bluebird.resolve({ body: { items: [] } });

    return promise
      .then(({ body }) => {
        const successes = [];

        for (let i = 0; i < body.items.length; i++) {
          const item = body.items[i][Object.keys(body.items[i])[0]];

          if (item.status >= 400) {
            partialErrors.push({
              document: documents[i],
              status: item.status,
              reason: item.error.reason
            });
          } else {
            successes.push({
              _id: item._id,
              _source: documents[i]._source,
              _status: item.status,
              _version: item._version,
              result: item.result
            });
          }
        }

        return {
          result: successes,
          errors: partialErrors
        };
      })
      .catch(err => this.esWrapper.reject(err));
  }

  /**
   * Extracts, injects metadata and validates documents contained
   * in a Request
   *
   * Used by mCreate, mUpdate, mReplace and mCreateOrReplace
   *
   * @param  {Array.<Object>} documents - Documents
   * @param  {Object} metadata - Kuzzle metadata
   * @param  {Object} options - prepareMGet (false)
   *
   * @return {Object} { rejected extractedDocuments documentsToGet }
   */
  _extractMDocuments(documents, metadata, { prepareMGet=false } = {}) {
    const
      rejected = [],
      extractedDocuments = [],
      documentsToGet = [];

    for (let i = 0; i < documents.length; i++) {
      const document = documents[i];

      if (_.isObject(document.body)) {
        const extractedDocument = {
          // Do not use destructuring, it's 10x slower
          _source: Object.assign({}, metadata, document.body)
        };

        if (document._id) {
          extractedDocument._id = document._id;
        }

        extractedDocuments.push(extractedDocument);

        if (prepareMGet && typeof document._id === 'string') {
          documentsToGet.push({
            _id: document._id,
            _source: false
          });
        }
      } else {
        rejected.push({
          document,
          reason: 'document body is not an object'
        });
      }
    }

    return { rejected, extractedDocuments, documentsToGet };
  }

  /**
   * Throws an error if the provided mapping is invalid
   *
   * @param {Object} mapping
   * @throws
   */
  _checkMappings (mapping, path = [], check = true) {
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
        this._checkMappings(mapping[property], [...path, 'properties'], false);
      } else if (mapping[property].properties) {
        // root properties level, check for "properties", "dynamic" and "_meta"
        this._checkMappings(mapping[property], [...path, property], true);
      }
    }
  }

  /**
   * Returns a new elasticsearch client instance
   *
   * @returns {Object}
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

    return new ESClient({ defer, ...this.config.client });
  }

  /**
   * Gets the name of an esIndex for an index + collection
   *
   * @param {String} index
   * @param {String} collection
   *
   * @returns {String} esIndex name (eg: '&nepali#liia')
   */
  _getESIndex (index, collection) {
    if (! index || ! collection) {
      return null;
    }

    return `${this.indexPrefix}${index}${NAME_SEPARATOR}${collection}`;
  }

  /**
   * Extracts the index name from esIndex name
   *
   * @param {String} esIndex
   *
   * @returns {String} index name
   */
  _extractIndex (esIndex) {
    return esIndex.substr(1, esIndex.indexOf(NAME_SEPARATOR) - 1);
  }

  /**
   * Extracts the collection name from esIndex name
   *
   * @param {String} esIndex
   *
   * @returns {String} collection name
   */
  _extractCollection (esIndex) {
    const separatorPos = esIndex.indexOf(NAME_SEPARATOR);

    return esIndex.substr(separatorPos + 1, separatorPos - 1);
  }

  /**
   * Returns a list of index names from esIndex names
   * By default, return the names of 'user' indexes.
   * The 'internal' option can be set to return the names of internal indexes
   *
   * @param {Array.<String>} esIndexes
   * @param {Object} options - internal (false)
   *
   * @returns {Array.<String>} index names
   */
  _extractIndexes (esIndexes) {
    const indexes = new Set();

    for (const esIndex of esIndexes) {
      if (esIndex[0] === this.indexPrefix) {
        indexes.add(this._extractIndex(esIndex));
      }
    }

    return Array.from(indexes);
  }

  /**
   * Returns a list of collection names for an index from esIndex names
   * By default, return the names of 'user' collections.
   * The 'internal' option can be set to return the names of internal collections
   *
   * @param {Array.<String>} esIndexes
   * @param {Object} options - internal (false)
   *
   * @returns {Array.<String>} collection names
   */
  _extractCollections (esIndexes, index) {
    const collections = new Set();

    for (const esIndex of esIndexes) {
      const [indexName, collectionName] =
        esIndex.substr(1, esIndex.length).split(NAME_SEPARATOR);

      if (esIndex[0] === this.indexPrefix && indexName === index) {
        collections.add(collectionName);
      }
    }

    return Array.from(collections);
  }

}

module.exports = ElasticSearch;

/**
 * Forbids the use of the _routing ES option
 *
 * @param {Object} esRequest
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
 * @param {Object} esRequest
 * @throws
 */
function assertWellFormedRefresh(esRequest) {
  if (! ['wait_for', 'false', false].includes(esRequest.refresh)) {
    errorsManager.throw('external', 'elasticsearch', 'wrong_refresh_parameter');
  }
}


function getUserId (userId) {
  if (! userId) {
    return null;
  }

  return String(userId);
}