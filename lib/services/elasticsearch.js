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

const
  debug = require('../util/debug')('kuzzle:services:elasticsearch'),
  _ = require('lodash'),
  Bluebird = require('bluebird'),
  ESWrapper = require('../util/esWrapper'),
  didYouMean = require('../util/didYouMean'),
  Service = require('./service'),
  { Client: ESClient } = require('@elastic/elasticsearch'),
  ms = require('ms'),
  { assertIsObject } = require('../util/requestAssertions'),
  errorsManager = require('../util/errors').wrap('services', 'storage'),
  semver = require('semver'),
  { isPlainObject } = require('../util/safeObject');

const scrollCachePrefix = '_docscroll_';

const rootMappingProperties = ['properties', '_meta', 'dynamic', 'dynamic_templates'];
const childMappingProperties = ['type'];

// Used for collection emulation
const
  HIDDEN_COLLECTION = '_kuzzle_keep',
  INTERNAL_PREFIX = '%',
  PUBLIC_PREFIX = '&',
  NAME_SEPARATOR = '.',
  FORBIDDEN_CHARS = `\\/*?"<>| \t\r\n,#:${NAME_SEPARATOR}${PUBLIC_PREFIX}${INTERNAL_PREFIX}`;

/**
 * @param {Kuzzle} kuzzle kuzzle instance
 * @param {Object} config Service configuration
 * @param {String} scope - "internal" or "public" (default "public")
 * @constructor
 */
class ElasticSearch extends Service {
  /**
   * Returns a new elasticsearch client instance
   *
   * @returns {Object}
   */
  static buildClient (config) {
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

      return { promise, reject, resolve };
    };

    return new ESClient({ defer, ...config });
  }

  constructor(kuzzle, config, scope = 'public') {
    super('elasticsearch', kuzzle, config);

    this._scope = scope;
    this._indexPrefix = scope === 'internal'
      ? INTERNAL_PREFIX
      : PUBLIC_PREFIX;

    this._client = null;
    this._esWrapper = null;
    this._esVersion = null;

    // Allowed root key of a search query
    this.searchBodyKeys = [
      'aggregations',
      'aggs',
      'collapse',
      'explain',
      'from',
      'highlight',
      'query',
      'search_timeout',
      'size',
      'sort',
      '_name',
      '_source',
      '_source_excludes',
      '_source_includes'
    ];
  }

  get scope () {
    return this._scope;
  }

  /**
   * Initializes the elasticsearch client
   *
   * @override
   * @returns {Promise}
   */
  _initSequence () {
    if (this._client) {
      return Bluebird.resolve(this);
    }

    if (process.env.NODE_ENV === 'production' && this._config.commonMapping.dynamic === 'true') {
      this._kuzzle.log.warn([
        'Your dynamic mapping policy is set to \'true\' for new fields.',
        'Elasticsearch will try to automatically infer mapping for new fields, and those cannot be changed afterward.',
        'See the "services.storageEngine.commonMapping.dynamic" option in the kuzzlerc configuration file to change this value.'
      ].join('\n'));
    }
    this._client = ElasticSearch.buildClient(this._config.client);
    this._esWrapper = new ESWrapper(this._client);

    return this._client.info()
      .then(({ body }) => {
        this._esVersion = body.version;

        if (this._esVersion && !semver.satisfies(this._esVersion.number, '>= 7.0.0')) {
          throw errorsManager.get('version_mismatch', this._esVersion.number);
        }
      });
  }

  /**
   * Returns some basic information about this service
   * @override
   *
   * @returns {Promise.<Object>} service informations
   */
  info () {
    const result = {
      type: 'elasticsearch',
      version: this._esVersion
    };

    return this._client.info()
      .then(({ body }) => {
        result.version = body.version.number;
        result.lucene = body.version.lucene_version;

        return this._client.cluster.health();
      })
      .then(({ body }) => {
        result.status = body.status;

        return this._client.cluster.stats({ human: true });
      })
      .then(({ body }) => {
        result.spaceUsed = body.indices.store.size;
        result.nodes = body.nodes;

        return result;
      })
      .catch(error => this._esWrapper.reject(error));
  }

  /**
   * Scrolls results from previous elasticsearch query
   *
   * @param {String} scrollId - Scroll identifier
   * @param {Object} options - scrollTTL (default scrollTTL)
   *
   * @returns {Promise.<Object>} { scrollId, hits, aggregations, total }
   */
  scroll (
    scrollId,
    { scrollTTL=this._config.defaults.scrollTTL } = {})
  {
    const esRequest = {
      scroll: scrollTTL,
      scrollId
    };

    const cacheKey = scrollCachePrefix + this._kuzzle.constructor.hash(
      esRequest.scrollId);

    debug('Scroll: %o', esRequest);

    return this._kuzzle.cacheEngine.internal.exists(cacheKey)
      .then(exists => {
        if (exists === 0) {
          throw errorsManager.get('unknown_scroll_id');
        }

        // ms(scroll) may return undefined if in microseconds or in nanoseconds
        const ttl = ms(scrollTTL) || ms(this._config.defaults.scrollTTL);

        return this._kuzzle.cacheEngine.internal.pexpire(cacheKey, ttl);
      })
      .then(() => this._client.scroll(esRequest))
      .then(({ body }) => this._formatSearchResult(body))
      .catch(error => this._esWrapper.reject(error));
  }

  /**
   * Searches documents from elasticsearch with a query
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} searchBody - Search request body (query, sort, etc.)
   * @param {Object} options - from (undefined), size (undefined), scroll (undefined)
   *
   * @returns {Promise.<Object>} { scrollId, hits, aggregations, total }
   */
  async search (
    index,
    collection,
    searchBody,
    { from, size, scroll } = {})
  {
    const esRequest = {
      body: this._sanitizeSearchBody(searchBody),
      from,
      index: this._getESIndex(index, collection),
      scroll,
      size
    };

    debug('Search: %j', esRequest);

    try {
      const { body } = await this._client.search(esRequest);

      if (body._scroll_id) {
        const
          // ms(scroll) may return undefined if in microseconds or in nanoseconds
          ttl = esRequest.scroll && ms(esRequest.scroll)
            || ms(this._config.defaults.scrollTTL),
          key = scrollCachePrefix + this._kuzzle.constructor.hash(body._scroll_id);

        await this._kuzzle.cacheEngine.internal.psetex(key, ttl, 0);
      }

      return this._formatSearchResult(body);
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }
  }

  _formatSearchResult (body) {
    const hits = [];

    for (let i = 0; i < body.hits.hits.length; i++) {
      const hit = body.hits.hits[i];

      hits.push({
        _id: hit._id,
        _score: hit._score,
        _source: hit._source,
        highlight: hit.highlight
      });
    }

    return {
      aggregations: body.aggregations,
      hits,
      scrollId: body._scroll_id,
      total: body.hits.total.value
    };
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
      id,
      index: this._getESIndex(index, collection)
    };

    // Just in case the user make a GET on url /mainindex/test/_search
    // Without this test we return something weird: a result.hits.hits with all
    // document without filter because the body is empty in HTTP by default
    if (esRequest.id === '_search') {
      return errorsManager.reject('search_as_an_id');
    }

    debug('Get document: %o', esRequest);

    return this._client.get(esRequest)
      .then(({ body }) => ({
        _id: body._id,
        _source: body._source,
        _version: body._version
      }))
      .catch(error => this._esWrapper.reject(error));
  }

  /**
   * Returns the list of documents matching the ids given in the body param
   * NB: Due to internal Kuzzle mechanism, can only be called on a single
   * index/collection, using the body { ids: [.. } syntax.
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Array.<String>} ids - Document IDs
   *
   * @returns {Promise.<Object>} { items: [ _id, _source, _version ], errors }
   */
  async mGet (index, collection, ids) {
    if (ids.length === 0) {
      return { errors: [], item: [] };
    }

    const
      esIndex = this._getESIndex(index, collection),
      esRequest = {
        body: {
          docs: ids.map(_id => ({ _id, _index: esIndex }))
        }
      };

    debug('Multi-get documents: %o', esRequest);

    let body;

    try {
      ({ body } = await this._client.mget(esRequest)); // NOSONAR
    }
    catch (e) {
      throw this._esWrapper.formatESError(e);
    }

    const
      errors = [],
      items = [];

    for (let i = 0; i < body.docs.length; i++) {
      const doc = body.docs[i];

      if (doc.found) {
        items.push({
          _id: doc._id,
          _source: doc._source,
          _version: doc._version
        });
      }
      else {
        errors.push(doc._id);
      }
    }

    return { errors, items };
  }

  /**
   * Counts how many documents match the filter given in body
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} searchBody - Search request body (query, sort, etc.)
   *
   * @returns {Promise.<Number>} count
   */
  count (index, collection, searchBody = {}) {
    const esRequest = {
      body: this._sanitizeSearchBody(searchBody),
      index: this._getESIndex(index, collection)
    };

    debug('Count: %o', esRequest);

    return this._client.count(esRequest)
      .then(({ body }) => body.count)
      .catch(error => this._esWrapper.reject(error));
  }

  /**
   * Sends the new document to elasticsearch
   * Cleans data to match elasticsearch specifications
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} content - Document content
   * @param {Object} options - id (undefined), refresh (undefined), userId (null)
   *
   * @returns {Promise.<Object>} { _id, _version, _source }
   */
  async create (
    index,
    collection,
    content,
    { id, refresh, userId=null } = {})
  {
    assertIsObject(content);

    const esRequest = {
      body: content,
      id,
      index: this._getESIndex(index, collection),
      op_type: id ? 'create' : 'index',
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

    debug('Create document: %o', esRequest);

    try {
      const { body } = await this._client.index(esRequest);

      return {
        _id: body._id,
        _source: esRequest.body,
        _version: body._version
      };
    }
    catch (error) {
      return this._esWrapper.reject(error);
    }
  }

  /**
   * Creates a new document to ElasticSearch, or replace it if it already exist
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Object} content - Document content
   * @param {Object} options - refresh (undefined), userId (null), injectKuzzleMeta (true)
   *
   * @returns {Promise.<Object>} { _id, _version, _source, created }
   */
  createOrReplace (
    index,
    collection,
    id,
    content,
    { refresh, userId=null, injectKuzzleMeta=true } = {})
  {
    const esRequest = {
      body: content,
      id,
      index: this._getESIndex(index, collection),
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

    debug('Create or replace document: %o', esRequest);

    return this._client.index(esRequest)
      .then(({ body }) => ({
        _id: body._id,
        _source: esRequest.body,
        _version: body._version,
        created: body.created // Needed by the notifier
      }))
      .catch(error => this._esWrapper.reject(error));
  }

  /**
   * Sends the partial document to elasticsearch with the id to update
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Object} content - Updated content
   * @param {Object} options - refresh (undefined), userId (null), retryOnConflict (0)
   *
   * @returns {Promise.<Object>} { _id, _version }
   */
  update (
    index,
    collection,
    id,
    content,
    { refresh, userId=null, retryOnConflict=this._config.defaults.onUpdateConflictRetries } = {})
  {
    const esRequest = {
      _source: true,
      body: { doc: content },
      id,
      index: this._getESIndex(index, collection),
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

    debug('Update document: %o', esRequest);

    return this._client.update(esRequest)
      .then(({ body }) => ({
        _id: body._id,
        _source: body.get._source,
        _version: body._version
      }))
      .catch(error => this._esWrapper.reject(error));
  }

  /**
   * Replaces a document to ElasticSearch
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Object} content - Document content
   * @param {Object} options - refresh (undefined), userId (null)
   *
   * @returns {Promise.<Object>} { _id, _version, _source }
   */
  replace (
    index,
    collection,
    id,
    content,
    { refresh, userId=null } = {})
  {
    const
      esIndex = this._getESIndex(index, collection),
      esRequest = {
        body: content,
        id,
        index: esIndex,
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

    return this._client.exists({ id, index: esIndex })
      .then(({ body: exists }) => {
        if (! exists) {
          throw errorsManager.get('not_found', id);
        }

        debug('Replace document: %o', esRequest);
        return this._client.index(esRequest);
      })
      .then(({ body }) => ({
        _id: id,
        _source: esRequest.body,
        _version: body._version
      }))
      .catch(error => this._esWrapper.reject(error));
  }

  /**
   * Sends to elasticsearch the document id to delete
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Object} options - refresh (undefined)
   *
   * @returns {Promise}
   */
  delete (
    index,
    collection,
    id,
    { refresh } = {})
  {
    const esRequest = {
      id,
      index: this._getESIndex(index, collection),
      refresh
    };

    assertWellFormedRefresh(esRequest);

    debug('Delete document: %o', esRequest);
    return this._client.delete(esRequest)
      .then(() => null)
      .catch(error => this._esWrapper.reject(error));
  }

  /**
   * Deletes all documents matching the provided filters
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} query - Query to match documents
   * @param {Object} options - from (undefined), size (undefined), refresh (undefined)
   *
   * @returns {Promise.<Object>} { documents, total, deleted, failures: [ _shardId, reason ] }
   */
  async deleteByQuery (
    index,
    collection,
    query,
    { refresh, from, size = 1000 } = {})
  {
    const esRequest = {
      body: this._sanitizeSearchBody({ query }),
      from,
      index: this._getESIndex(index, collection),
      scroll: '5s',
      size
    };

    if (!isPlainObject(query)) {
      throw errorsManager.get('missing_argument', 'body.query');
    }

    await this.refreshCollection(index, collection);

    try {
      const documents = await this._getAllDocumentsFromQuery(esRequest);

      debug('Delete by query: %o', esRequest);

      esRequest.refresh = refresh === 'wait_for' ? true : refresh;

      const { body } = await this._client.deleteByQuery(esRequest);

      return {
        deleted: body.deleted,
        documents,
        failures:
          body.failures.map(({ shardId, reason }) => ({
            reason,
            shardId
          })),
        total: body.total
      };
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }
  }

  /**
   * Execute the callback with a batch of documents of specified size until all
   * documents matched by the query have been processed.
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} query - Query to match documents
   * @param {Function} callback - callback that will be called with the "hits" array
   * @param {Object} options - size (10), scrollTTL ('5s')
   *
   * @returns {Promise.<any[]>} Array of results returned by the callback
   */
  batchExecute (
    index,
    collection,
    query,
    callback,
    { size=10, scrollTTl= '5s' } = {})
  {
    const esRequest = {
      body: this._sanitizeSearchBody({ query }),
      from: 0,
      index: this._getESIndex(index, collection),
      scroll: scrollTTl,
      size
    };

    if (! _.isPlainObject(query)) {
      return errorsManager.reject('missing_argument', 'body.query');
    }

    const
      client = this._client,
      results = [];

    let processed = 0;

    return new Bluebird((resolve, reject) => {
      this._client.search(
        esRequest,
        async function getMoreUntilDone(error, { body: { hits, _scroll_id } }) {
          if (error) {
            reject(error);
            return;
          }

          const ret = callback(hits.hits);

          results.push(await ret);
          processed += hits.hits.length;

          if (hits.total.value !== processed) {
            client.scroll({
              scroll: esRequest.scroll,
              scrollId: _scroll_id
            }, getMoreUntilDone);
          }
          else {
            resolve(results);
          }
        });
    });
  }

  /**
   * Creates a new index.
   *
   * This methods creates an hidden collection in the provided index to be
   * able to list it.
   * This methods resolves if the index name does not already exists either as
   * internal or public index.
   *
   * @param {String} index - Index name
   *
   * @returns {Promise}
   */
  async createIndex (index) {
    this._assertValidIndexAndCollection(index);

    let body;

    try {
      ({ body } = await this._client.cat.indices({ format: 'json' })); // NOSONAR
    }
    catch (e) {
      return this._esWrapper.reject(e);
    }

    const esIndexes = body.map(({ index: name }) => name);
    for (const esIndex of esIndexes) {
      const indexName = this._extractIndex(esIndex);

      if (index === indexName) {
        const indexType = esIndex[0] === INTERNAL_PREFIX
          ? 'private'
          : 'public';

        throw errorsManager.get('index_already_exists', indexType, index);
      }
    }

    const esRequest = {
      body: {},
      index: this._getESIndex(index, HIDDEN_COLLECTION)
    };

    try {
      await this._client.indices.create(esRequest);
    }
    catch (e) {
      return this._esWrapper.reject(e);
    }

    return null;
  }

  /**
   * Creates an empty collection.
   * Mappings and settings will be applied if supplied.
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} config - mappings ({}), settings ({})
   *
   * @returns {Promise}
   */
  async createCollection (index, collection, { mappings={}, settings={} } = {}) {
    this._assertValidIndexAndCollection(index, collection);

    const esRequest = {
      body: {
        mappings: {},
        settings
      },
      index: this._getESIndex(index, collection)
    };

    if (collection === HIDDEN_COLLECTION) {
      throw errorsManager.get('collection_reserved', HIDDEN_COLLECTION);
    }

    const exists = await this.collectionExists(index, collection);

    if (exists) {
      return this.updateCollection(index, collection, { mappings, settings });
    }

    this._checkMappings(mappings);

    esRequest.body.mappings = {
      _meta: mappings._meta || this._config.commonMapping._meta,
      dynamic: mappings.dynamic || this._config.commonMapping.dynamic,
      properties: _.merge(
        mappings.properties,
        this._config.commonMapping.properties)
    };

    try {
      await this._client.indices.create(esRequest);
    }
    catch (error) {
      if (_.get(error, 'meta.body.error.type') === 'resource_already_exists_exception') {
        // race condition: the index has been created between the "exists"
        // check above and this "create" attempt
        return null;
      }

      throw this._esWrapper.formatESError(error);
    }

    return null;
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

    debug('Get mapping: %o', esRequest);

    return this._client.indices.getMapping(esRequest)
      .then(({ body }) => {
        const properties = includeKuzzleMeta
          ? body[esIndex].mappings.properties
          : _.omit(body[esIndex].mappings.properties, '_kuzzle_info');

        return {
          _meta: body[esIndex].mappings._meta,
          dynamic: body[esIndex].mappings.dynamic,
          properties
        };
      })
      .catch(error => this._esWrapper.reject(error));
  }

  /**
   * Updates a collection mappings and settings
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} config - mappings ({}), settings ({})
   *
   * @return {Promise}
   */
  async updateCollection (index, collection, { mappings={}, settings={} } = {}) {
    const esRequest = {
      index: this._getESIndex(index, collection)
    };

    // If either the putMappings or the putSettings operation fail, we need to
    // rollback the whole operation. Since mappings can't be rollback, we try to
    // update the settings first, then the mappings and we rollback the settings
    // if putMappings fail.
    let esIndexSettings;
    try {
      const response = await this._client.indices.getSettings(esRequest);
      esIndexSettings = response.body[esRequest.index].settings;
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }

    if (!_.isEmpty(settings)) {
      await this.updateSettings(index, collection, settings);
    }

    try {
      if (!_.isEmpty(mappings)) {
        await this.updateMapping(index, collection, mappings);
      }
    }
    catch (error) {
      const allowedSettings = {
        index: _.omit(
          esIndexSettings.index,
          ['creation_date', 'provided_name', 'uuid', 'version'])
      };

      // Rollback to previous settings
      await this.updateSettings(index, collection, allowedSettings);

      throw error;
    }

    return null;
  }

  /**
   * Update a collection mappings
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
          _meta: mappings._meta || collectionMappings._meta,
          dynamic: mappings.dynamic || collectionMappings.dynamic,
          properties: mappings.properties
        };

        fullProperties = _.merge(collectionMappings.properties, mappings.properties);

        debug('Update mapping: %o', esRequest);
        return this._client.indices.putMapping(esRequest);
      })
      .then(() => ({
        _meta: esRequest.body._meta,
        dynamic: esRequest.body.dynamic,
        properties: fullProperties
      }))
      .catch(error => this._esWrapper.reject(error));
  }

  /**
   * Updates a collection settings (eg: analyzers)
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} settings - Collection settings in ES format
   *
   * @returns {Promise}
   */
  async updateSettings (index, collection, settings = {}) {
    const esRequest = {
      body: settings,
      index: this._getESIndex(index, collection)
    };

    // If the esindex analyser is changed, we need to close it first
    if (settings.analysis) {
      await this._client.indices.close(esRequest);
    }

    try {
      await this._client.indices.putSettings(esRequest);
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }
    finally {
      if (settings.analysis) {
        await this._client.indices.open(esRequest);
      }
    }

    return null;
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

    return this.getMapping(index, collection, { includeKuzzleMeta: true })
      .then(collectionMappings => {
        mappings = collectionMappings;

        return this._client.indices.delete(esRequest);
      })
      .then(() => this._client.indices.create({ ...esRequest, body: { mappings } }))
      .then(() => null)
      .catch(error => this._esWrapper.reject(error));
  }

  /**
   * Runs several action and document
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Array.<Object>} documents - Documents to import
   * @param {Object} options - timeout (undefined), refresh (undefined), userId (null)
   *
   * @returns {Promise.<Object>} { items, errors }
   */
  import (
    index,
    collection,
    documents,
    { refresh, timeout, userId=null } = {})
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
          updatedAt: dateNow,
          updater: getUserId(userId)
        }
      };

    assertWellFormedRefresh(esRequest);

    let
      actionCount = 0,
      lastAction; // NOSONAR

    /**
     * @warning Critical code section
     *
     * bulk body can contain more than 10K elements
     */
    for (let i = 0; i < esRequest.body.length; i++) {
      const
        item = esRequest.body[i],
        action = Object.keys(item)[0];

      if (actionNames.indexOf(action) !== -1) {
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
          if (isPlainObject(item[prop])) {
            item[prop]._kuzzle_info = kuzzleMeta.updated;
          }
        }
      }
    }
    /* end critical code section */

    if (actionCount > this._kuzzle.config.limits.documentsWriteCount) {
      return errorsManager.reject('write_limit_exceeded');
    }

    return this._client.bulk(esRequest)
      .then(({ body }) => {
        const result = {
          errors: [],
          items: []
        };

        let idx = 0;

        /**
         * @warning Critical code section
         *
         * bulk body can contain more than 10K elements
         */
        for (let i = 0; i < body.items.length; i++) {
          const
            row = body.items[i],
            action = Object.keys(row)[0],
            item = row[action];

          if (item.status >= 400) {
            const error = {
              _id: item._id,
              status: item.status
            };

            // update action contain body in "doc" field
            // the delete action is not followed by an action payload
            if (action === 'update') {
              error._source = documents[idx + 1].doc;
              delete error._source._kuzzle_info;
            }
            else if (action !== 'delete') {
              error._source = documents[idx + 1];
              delete error._source._kuzzle_info;
            }

            // ES response does not systematicaly includes an error object
            // (eg: delete action with 404 status)
            if (item.error) {
              error.error = {
                reason: item.error.reason,
                type: item.error.type
              };
            }

            result.errors.push({ [action]: error });
          }
          else {
            result.items.push({
              [action]: {
                _id: item._id,
                status: item.status
              }
            });
          }

          // the delete action is not followed by an action payload
          idx = action === 'delete'
            ? idx + 1
            : idx + 2;
        }
        /* end critical code section */

        return result;
      })
      .catch(error => this._esWrapper.reject(error));
  }

  /**
   * Retrieves the complete list of existing collections in the current index
   *
   * @param {String} index - Index name
   *
   * @returns {Promise.<Array>} Collection names
   */
  listCollections (index) {
    return this._client.cat.indices({ format: 'json' })
      .then(({ body }) => {
        const esIndexes = body.map(({ index: esIndex }) => esIndex);

        return this._extractCollections(esIndexes, index);
      })
      .catch(error => this._esWrapper.reject(error));
  }

  /**
   * Retrieves the complete list of indexes
   *
   * @returns {Promise.<Array>} Index names
   */
  listIndexes () {
    return this._client.cat.indices({ format: 'json' })
      .then(({ body }) => {
        const esIndexes = body.map(({ index }) => index);

        return this._extractIndexes(esIndexes);
      })
      .catch(error => this._esWrapper.reject(error));
  }

  /**
   * Retrieves the complete list of aliases
   *
   * @returns {Promise.<Object[]>} [ { name, index, collection } ]
   */
  listAliases () {
    return this._client.cat.aliases({ format: 'json' })
      .then(({ body }) => {
        const aliases = [];

        for (const { alias, index: esIndex } of body) {
          if (esIndex[0] === this._indexPrefix) {
            aliases.push({
              collection: this._extractCollection(esIndex),
              index: this._extractIndex(esIndex),
              name: alias
            });
          }
        }

        return aliases;
      })
      .catch(error => this._esWrapper.reject(error));
  }

  /**
   * Deletes a collection
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   *
   * @returns {Promise}
   */
  deleteCollection (index, collection) {
    const esRequest = {
      index: this._getESIndex(index, collection)
    };

    return this._client.indices.delete(esRequest)
      .then(() => null)
      .catch(error => this._esWrapper.reject(error));
  }

  /**
   * Deletes multiple indexes
   *
   * @param {String[]} indexes - Index names
   *
   * @return {Promise.<String[]>}
   */
  deleteIndexes (indexes = []) {
    if (indexes.length === 0) {
      return Bluebird.resolve([]);
    }

    const deleted = new Set();

    return this._client.cat.indices({ format: 'json' })
      .then(({ body }) => {
        const
          esIndexes = body
            .map(({ index }) => index)
            .filter(esIndex => {
              const index = this._extractIndex(esIndex);

              if (esIndex[0] !== this._indexPrefix || ! indexes.includes(index)) {
                return false;
              }

              deleted.add(index);

              return true;
            }),
          esRequest = {
            index: esIndexes
          };

        debug('Delete indexes: %o', esRequest);
        return this._client.indices.delete(esRequest);
      })
      .then(() => Array.from(deleted))
      .catch(error => this._esWrapper.reject(error));
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
      .then(() => null);
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

    return this._client.indices.refresh(esRequest)
      .then(({ body }) => ({
        _shards: body._shards
      }))
      .catch(error => this._esWrapper.reject(error));
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
      id,
      index: this._getESIndex(index, collection)
    };

    return this._client.exists(esRequest)
      .then(({ body: exists }) => exists)
      .catch(error => this._esWrapper.reject(error));
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
      .then(indexes => indexes.some(idx => idx === index));
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
      .then(collections => collections.some(col => col === collection));
  }

  /**
   * Creates multiple documents at once.
   * If a content has no id, one is automatically generated and assigned to it.
   * If a content has a specified identifier, it is rejected if it already exists
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Array.<Object>} documents - Documents
   * @param {Object} options - timeout (undefined), refresh (undefined), userId (null)
   *
   * @return {Promise.<Object>} { items, errors }
   */
  async mCreate (
    index,
    collection,
    documents,
    { refresh, timeout, userId=null } = {})
  {
    const
      esIndex = this._getESIndex(index, collection),
      kuzzleMeta = {
        _kuzzle_info: {
          author: getUserId(userId),
          createdAt: Date.now(),
          updatedAt: null,
          updater: null
        }
      },
      {
        rejected,
        extractedDocuments,
        documentsToGet
      } = this._extractMDocuments(documents, kuzzleMeta, { prepareMGet: true });

    // prepare the mget request, but only for document having a specified id
    const {body} = documentsToGet.length > 0
      ? await this._client.mget({body: {docs: documentsToGet}, index: esIndex})
      : {body: {docs: []}};

    const
      existingDocuments = body.docs,
      esRequest = {
        body: [],
        index: esIndex,
        refresh,
        timeout
      },
      toImport = [];

    /**
     * @warning Critical code section
     *
     * request can contain more than 10K elements
     */
    for (let i = 0, idx = 0; i < extractedDocuments.length; i++) {
      const document = extractedDocuments[i];

      // Documents are retrieved in the same order than we got them from user
      if (typeof document._id === 'string' && existingDocuments[idx]) {
        if (existingDocuments[idx].found) {
          delete document._source._kuzzle_info;

          rejected.push({
            document: {
              _id: document._id,
              body: document._source
            },
            reason: 'document already exists',
            status: 400
          });

          idx++;
        }
        else {
          esRequest.body.push({
            index: {
              _id: document._id,
              _index: esIndex
            }
          });
          esRequest.body.push(document._source);

          toImport.push(document);
        }
      }
      else {
        esRequest.body.push({ index: { _index: esIndex } });
        esRequest.body.push(document._source);

        toImport.push(document);
      }
    }
    /* end critical code section */

    return this._mExecute(esRequest, toImport, rejected);
  }

  /**
   * Creates or replaces multiple documents at once.
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Array.<Object>} documents - Documents
   * @param {Object} options - timeout (undefined), refresh (undefined), userId (null), injectKuzzleMeta (false)
   *
   * @return {Promise.<Object>} { items, errors }
   */
  mCreateOrReplace(
    index,
    collection,
    documents,
    { refresh, timeout, userId=null, injectKuzzleMeta=true } = {})
  {
    let kuzzleMeta = {};

    if (injectKuzzleMeta) {
      kuzzleMeta = {
        _kuzzle_info: {
          author: getUserId(userId),
          createdAt: Date.now(),
          updatedAt: null,
          updater: null
        }
      };
    }

    const
      esIndex = this._getESIndex(index, collection),
      esRequest = {
        body: [],
        index: esIndex,
        refresh,
        timeout
      },
      {
        rejected,
        extractedDocuments
      } = this._extractMDocuments(documents, kuzzleMeta);

    esRequest.body = [];

    /**
     * @warning Critical code section
     *
     * request can contain more than 10K elements
     */
    for (let i = 0; i < extractedDocuments.length; i++) {
      esRequest.body.push({
        index: {
          _id: extractedDocuments[i]._id,
          _index: esIndex
        }
      });
      esRequest.body.push(extractedDocuments[i]._source);
    }
    /* end critical code section */

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
   * @param {Object} options - timeout (undefined), refresh (undefined), userId (null)
   *
   * @return {Promise.<Object>} { items, errors }
   */
  async mUpdate (
    index,
    collection,
    documents,
    { refresh, timeout, userId=null } = {})
  {
    const
      esIndex = this._getESIndex(index, collection),
      toImport = [],
      esRequest = {
        body: [],
        index: esIndex,
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

    /**
     * @warning Critical code section
     *
     * request can contain more than 10K elements
     */
    for (let i = 0; i < extractedDocuments.length; i++) {
      const extractedDocument = extractedDocuments[i];

      if (typeof extractedDocument._id === 'string') {
        esRequest.body.push({
          update: {
            _id: extractedDocument._id,
            _index: esIndex
          }
        });

        // _source: true => makes ES return the updated document source in the
        // response. Required by the real-time notifier component
        esRequest.body.push({
          _source: true,
          doc: extractedDocument._source
        });
        toImport.push(extractedDocument);
      }
      else {
        delete extractedDocument._source._kuzzle_info;

        rejected.push({
          document: {
            _id: extractedDocument._id,
            body: extractedDocument._source
          },
          reason: 'document _id must be a string',
          status: 400
        });
      }
    }
    /* end critical code section */

    const response = await this._mExecute(esRequest, toImport, rejected);

    // with _source: true, ES returns the updated document in
    // response.result.get._source
    // => we replace response.result._source with it so that the notifier
    // module can seamlessly process all kind of m* response*
    response.items = response.items.map(item => ({
      _id: item._id,
      _source: item.get._source,
      result: item.result,
      status: item.status
    }));

    return response;
  }

  /**
   * Replaces multiple documents at once.
   * Replacements are rejected if targeted documents do not exist
   * (like with the normal "replace" method)
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Array.<Object>} documents - Documents
   * @param {Object} options - timeout (undefined), refresh (undefined), userId (null)
   *
   * @return {Promise.<Object>} { items, errors }
   */
  async mReplace (
    index,
    collection,
    documents,
    { refresh, timeout, userId=null } = {})
  {
    const
      esIndex = this._getESIndex(index, collection),
      kuzzleMeta = {
        _kuzzle_info: {
          author: getUserId(userId),
          createdAt: Date.now(),
          updatedAt: null,
          updater: null
        }
      },
      {
        rejected,
        extractedDocuments,
        documentsToGet
      } = this._extractMDocuments(
        documents,
        kuzzleMeta,
        { prepareMGet: true, requireId: true });

    if (documentsToGet.length < 1) {
      return { errors: rejected, items: [] };
    }

    const {body} = await this._client.mget({
      body: { docs: documentsToGet },
      index: esIndex
    });

    const
      existingDocuments = body.docs,
      esRequest = {
        body: [],
        refresh,
        timeout
      },
      toImport = [];

    /**
     * @warning Critical code section
     *
     * request can contain more than 10K elements
     */
    for (let i = 0; i < extractedDocuments.length; i++) {
      const document = extractedDocuments[i];

      // Documents are retrieved in the same order than we got them from user
      if (existingDocuments[i] && existingDocuments[i].found) {
        esRequest.body.push({
          index: {
            _id: document._id,
            _index: esIndex
          }
        });
        esRequest.body.push(document._source);

        toImport.push(document);
      }
      else {
        delete document._source._kuzzle_info;

        rejected.push({
          document: {
            _id: document._id,
            body: document._source
          },
          reason: 'document not found',
          status: 404
        });
      }
    }
    /* end critical code section */

    return this._mExecute(esRequest, toImport, rejected);
  }

  /**
   * Deletes multiple documents with one request
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Array.<String>} documents - Documents IDs
   * @param {Object} options - timeout (undefined), refresh (undefined)
   *
   * @return {Promise.<Object>} { documents, errors }
   */
  async mDelete (
    index,
    collection,
    ids,
    { refresh, timeout } = {})
  {
    const
      query = { ids: { values: [] } },
      validIds = [],
      partialErrors = [];

    /**
     * @warning Critical code section
     *
     * request can contain more than 10K elements
     */
    for (let i = 0; i < ids.length; i++) {
      const _id = ids[i];

      if (typeof _id === 'string') {
        validIds.push(_id);
      }
      else {
        partialErrors.push({
          _id,
          reason: 'document _id must be a string',
          status: 400
        });
      }
    }
    /* end critical code section */

    const {items} = await this.mGet(index, collection, validIds);

    let idx = 0;

    /**
     * @warning Critical code section
     *
     * request can contain more than 10K elements
     */
    for (let i = 0; i < validIds.length; i++) {
      const
        validId = validIds[i],
        item = items[idx];

      if (item && item._id === validId) {
        query.ids.values.push(validId);
        idx++;
      }
      else {
        partialErrors.push({
          _id: validId,
          reason: 'document not found',
          status: 404
        });
      }
    }
    /* end critical code section */

    // @todo duplicated query to get documents body, mGet here and search in
    // deleteByQuery
    const {documents} = await this.deleteByQuery(
      index,
      collection,
      query,
      { refresh, timeout });

    return {documents, errors: partialErrors};
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
   * @return {Promise.<Object[]>} results
   */
  _mExecute (esRequest, documents, partialErrors) {
    assertWellFormedRefresh(esRequest);

    if (documents.length > this._kuzzle.config.limits.documentsWriteCount) {
      return errorsManager.reject('write_limit_exceeded');
    }

    const promise = documents.length > 0
      ? this._client.bulk(esRequest)
      : Bluebird.resolve({ body: { items: [] } });

    return promise
      .then(({ body }) => {
        const successes = [];

        /**
         * @warning Critical code section
         *
         * request can contain more than 10K elements
         */
        for (let i = 0; i < body.items.length; i++) {
          const
            item = body.items[i],
            result = item[Object.keys(item)[0]];

          if (result.status >= 400) {
            if (result.status === 404) {
              partialErrors.push({
                document: {
                  _id: documents[i]._id,
                  body: documents[i]._source
                },
                reason: 'document not found',
                status: result.status
              });
            }
            else {
              partialErrors.push({
                document: documents[i],
                reason: result.error.reason,
                status: result.status
              });
            }
          } else {
            successes.push({
              _id: result._id,
              _source: documents[i]._source,
              _version: result._version,
              created: result.created,
              get: result.get,
              result: result.result,
              status: result.status // used by mUpdate to get the full document body
            });
          }
        }
        /* end critical code section */

        return {
          errors: partialErrors, // @todo rename items to documents
          items: successes
        };
      })
      .catch(err => this._esWrapper.reject(err));
  }

  /**
   * Extracts, injects metadata and validates documents contained
   * in a Request
   *
   * Used by mCreate, mUpdate, mReplace and mCreateOrReplace
   *
   * @param  {Array.<Object>} documents - Documents
   * @param  {Object} metadata - Kuzzle metadata
   * @param  {Object} options - prepareMGet (false), requireId (false)
   *
   * @return {Object} { rejected, extractedDocuments, documentsToGet }
   */
  _extractMDocuments (documents, metadata, { prepareMGet=false, requireId=false } = {}) {
    const
      rejected = [],
      extractedDocuments = [],
      documentsToGet = [];

    /**
     * @warning Critical code section
     *
     * request can contain more than 10K elements
     */
    for (let i = 0; i < documents.length; i++) {
      const document = documents[i];

      if (!isPlainObject(document.body)) {
        rejected.push({
          document,
          reason: 'document body must be an object',
          status: 400
        });
      }
      else if (requireId && typeof document._id !== 'string') {
        rejected.push({
          document,
          reason: 'document _id must be a string',
          status: 400
        });
      }
      else {
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
      }
    }
    /* end critical code section */

    return { documentsToGet, extractedDocuments, rejected };
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

        throw errorsManager.get(
          'invalid_mapping',
          currentPath,
          didYouMean(property, mappingProperties));
      }

      if (property === 'properties') {
        // type definition level, we don't check
        this._checkMappings(mapping[property], [...path, 'properties'], false);
      }
      else if (mapping[property] && mapping[property].properties) {
        // root properties level, check for "properties", "dynamic" and "_meta"
        this._checkMappings(mapping[property], [...path, property], true);
      }
    }
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

    return `${this._indexPrefix}${index}${NAME_SEPARATOR}${collection}`;
  }

  /**
   * Throws if index or collection includes forbidden characters
   *
   * @param {String} index
   * @param {String} collection
   */
  _assertValidIndexAndCollection (index, collection = null) {
    if (!this.isIndexNameValid(index)) {
      throw errorsManager.get('invalid_index_name', index);
    }

    if (collection !== null && !this.isCollectionNameValid(collection)) {
      throw errorsManager.get('invalid_collection_name', collection);
    }
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

    return esIndex.substr(separatorPos + 1, esIndex.length);
  }

  /**
   * Returns a list of index names from esIndex names.
   *
   * @param {Array.<String>} esIndexes
   * @param {Object} options - internal (false)
   *
   * @returns {Array.<String>} index names
   */
  _extractIndexes (esIndexes) {
    const indexes = new Set();

    for (const esIndex of esIndexes) {
      const separatorIndex = esIndex.indexOf(NAME_SEPARATOR);

      if ( esIndex[0] === this._indexPrefix
        && separatorIndex !== -1
        && separatorIndex !== esIndex.length -1
      ) {
        indexes.add(this._extractIndex(esIndex));
      }
    }

    return Array.from(indexes);
  }

  /**
   * Returns a list of collection names for an index from esIndex names
   *
   * @param {Array.<String>} esIndexes
   * @param {Object} options - internal (false)
   *
   * @returns {Array.<String>} collection names
   */
  _extractCollections (esIndexes, index) {
    const collections = new Set();

    for (const esIndex of esIndexes) {
      const [ indexName, collectionName ] = esIndex
        .substr(1, esIndex.length)
        .split(NAME_SEPARATOR);

      if ( esIndex[0] === this._indexPrefix
        && indexName === index
        && collectionName !== HIDDEN_COLLECTION
      ) {
        collections.add(collectionName);
      }
    }

    return Array.from(collections);
  }

  /**
   * Scroll index in elasticsearch and return all document that match the filter
   * /!\ throws a write_limit_exceed error: this method is intended to be used
   * by deleteByQuery
   *
   * @param {Object} esRequest - Search request body
   *
   * @returns {Promise.<Array>} resolve to an array of documents
   */
  async _getAllDocumentsFromQuery (esRequest) {
    let { body: { hits, _scroll_id } } = await this._client.search(esRequest);

    if (hits.total.value > this._kuzzle.config.limits.documentsWriteCount) {
      throw errorsManager.get('write_limit_exceeded');
    }

    let documents = hits.hits.map(h => ({ _id: h._id, _source: h._source }));

    while (hits.total.value !== documents.length) {
      ({ body: { hits, _scroll_id } } = await this._client.scroll({ //NOSONAR
        scroll: esRequest.scroll,
        scrollId: _scroll_id
      }));

      documents = documents.concat(hits.hits.map(h => ({
        _id: h._id,
        _source: h._source
      })));
    }

    return documents;
  }

  /**
   * Clean and normalize the searchBody
   * Ensure only allowed parameters are passed to ES
   *
   * @param {Object} searchBody - ES search body (with query, aggregations, sort, etc)
   */
  _sanitizeSearchBody (searchBody) {
    // Only allow a whitelist of top level properties
    for (const key of Object.keys(searchBody)) {
      if (!this.searchBodyKeys.includes(key)) {
        throw errorsManager.get('invalid_search_query', key);
      }
    }

    // Avoid empty queries that causes ES to respond with an error.
    // Empty queries are turned into match_all queries
    if (_.isEmpty(searchBody.query)) {
      searchBody.query = { match_all: {} };
    }

    return searchBody;
  }

  /**
   * Checks if a collection name is valid
   * @param  {string}  name
   * @return {Boolean}
   */
  isCollectionNameValid (name) {
    return _isObjectNameValid(name);
  }

  /**
   * Checks if a collection name is valid
   * @param  {string}  name
   * @return {Boolean}
   */
  isIndexNameValid (name) {
    return _isObjectNameValid(name);
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
    throw errorsManager.get('no_routing');
  }
}

/**
 * Checks if the optional "refresh" argument is well-formed
 *
 * @param {Object} esRequest
 * @throws
 */
function assertWellFormedRefresh(esRequest) {
  if (! ['wait_for', 'false', false, undefined].includes(esRequest.refresh)) {
    throw errorsManager.get('invalid_argument', 'refresh', '"wait_for", false');
  }
}

function getUserId (userId) {
  if (! userId) {
    return null;
  }

  return String(userId);
}

/**
 * Checks if an index or collection name is valid
 *
 * @see https://www.elastic.co/guide/en/elasticsearch/reference/7.4/indices-create-index.html
 *
 * Beware of the length check: ES allows index names up to 255 bytes, but since
 * in Kuzzle we emulate collections as indexes, we have to make sure
 * that the privacy prefix, the index name, the separator and the collection
 * name ALL fit within the 255-bytes limit of Elasticsearch. The simplest way
 * is to limit index and collection names to 126 bytes and document that
 * limitation (prefix(1) + index(1..126) + sep(1) + collection(1..126) = 4..254)
 *
 * @param  {string}  name
 * @return {Boolean}
 */
function _isObjectNameValid (name) {
  if (typeof name !== 'string' || name.length === 0) {
    return false;
  }

  if (name.toLowerCase() !== name) {
    return false;
  }

  if (Buffer.from(name).length > 126) {
    return false;
  }

  let valid = true;

  for (let i = 0; valid && i < FORBIDDEN_CHARS.length; i++) {
    valid = !name.includes(FORBIDDEN_CHARS[i]);
  }

  return valid;
}
