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

const assert = require('assert');
const _ = require('lodash');
const { Client: StorageClient } = require('@elastic/elasticsearch');
const ms = require('ms');
const Bluebird = require('bluebird');
const semver = require('semver');

const debug = require('../../util/debug')('kuzzle:services:elasticsearch');
const ESWrapper = require('./esWrapper');
const QueryTranslator = require('./queryTranslator');
const didYouMean = require('../../util/didYouMean');
const Service = require('../service');
const { assertIsObject } = require('../../util/requestAssertions');
const kerror = require('../../kerror').wrap('services', 'storage');
const { isPlainObject } = require('../../util/safeObject');
const scopeEnum = require('../../core/storage/storeScopeEnum');
const extractFields = require('../../util/extractFields');
const { Mutex } = require('../../util/mutex');
const { generateRandomCustom } = require('../../util/name-generator');

const SCROLL_CACHE_PREFIX = '_docscroll_';

const ROOT_MAPPING_PROPERTIES = ['properties', '_meta', 'dynamic', 'dynamic_templates'];
const CHILD_MAPPING_PROPERTIES = ['type'];

// Used for collection emulation
const HIDDEN_COLLECTION = '_kuzzle_keep';
const PRIVATE_PREFIX = '%';
const PUBLIC_PREFIX = '&';
const INDEX_PREFIX_POSITON_IN_INDEX = 0;
const INDEX_PREFIX_POSITON_IN_ALIAS = 1;
const ALIAS_PREFIX = '@'; // @todo next major release: Add ALIAS_PREFIX in FORBIDDEN_CHARS
const NAME_SEPARATOR = '.';
const FORBIDDEN_CHARS = `\\/*?"<>| \t\r\n,+#:${NAME_SEPARATOR}${PUBLIC_PREFIX}${PRIVATE_PREFIX}`;
const DYNAMIC_PROPERTY_VALUES = ['true', 'false', 'strict'];

// used to check whether we need to wait for ES to initialize or not
const esStateEnum = Object.freeze({
  'AWAITING': 1,
  'NONE': 2,
  'OK': 3,
});
let esState = esStateEnum.NONE;

/**
 * @param {Kuzzle} kuzzle kuzzle instance
 * @param {Object} config Service configuration
 * @param {storeScopeEnum} scope
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
      let resolve;
      let reject;

      const promise = new Bluebird((res, rej) => {
        resolve = res;
        reject = rej;
      });

      return { promise, reject, resolve };
    };

    return new StorageClient({ defer, ...config });
  }

  constructor(config, scope = scopeEnum.PUBLIC) {
    super('elasticsearch', config);

    this._scope = scope;
    this._indexPrefix = scope === scopeEnum.PRIVATE
      ? PRIVATE_PREFIX
      : PUBLIC_PREFIX;

    this._client = null;
    this._esWrapper = null;
    this._esVersion = null;
    this._translator = new QueryTranslator();

    // Allowed root key of a search query
    this.searchBodyKeys = [
      'aggregations',
      'aggs',
      'collapse',
      'explain',
      'from',
      'highlight',
      'inner_hits',
      'query',
      'search_after',
      'search_timeout',
      'size',
      'sort',
      'suggest',
      '_name',
      '_source',
      '_source_excludes',
      '_source_includes'
    ];

    // Forbidden keys in a query
    this.scriptKeys = [
      'script',
      '_script'
    ];


    this.maxScrollDuration = this._loadMsConfig('maxScrollDuration');

    this.scrollTTL = this._loadMsConfig('defaults.scrollTTL');
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
  async _initSequence () {
    if (this._client) {
      return;
    }

    if ( global.NODE_ENV !== 'development'
      && this._config.commonMapping.dynamic === 'true'
    ) {
      global.kuzzle.log.warn([
        'Your dynamic mapping policy is set to \'true\' for new fields.',
        'Elasticsearch will try to automatically infer mapping for new fields, and those cannot be changed afterward.',
        'See the "services.storageEngine.commonMapping.dynamic" option in the kuzzlerc configuration file to change this value.'
      ].join('\n'));
    }

    this._client = ElasticSearch.buildClient(this._config.client);

    await this.waitForElasticsearch();

    this._esWrapper = new ESWrapper(this._client);

    const { body: { version } } = await this._client.info();

    if (version && !semver.satisfies(semver.coerce(version.number), '>= 7.0.0')) {
      throw kerror.get('version_mismatch', version.number);
    }

    this._esVersion = version;
  }

  /**
   * Translate Koncorde filters to Elasticsearch query
   *
   * @param {Object} koncordeFilters - Set of valid Koncorde filters
   * @returns {Object} Equivalent Elasticsearch query
   */
  translateKoncordeFilters (filters) {
    return this._translator.translate(filters);
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
   * Returns detailed multi-level storage stats data
   *
   * @returns {Promise.<Object>}
   */
  async stats () {
    const esRequest = {
      metric: ['docs', 'store'],
    };

    const { body } = await this._client.indices.stats(esRequest);
    const indexes = {};
    let size = 0;

    for (const [esIndex, esIndexInfo] of Object.entries(body.indices)) {
      const alias = await this._getAliasFromESIndex(esIndex);
      const indexName = this._extractIndex(alias);
      const collectionName = this._extractCollection(alias);

      if ( alias[INDEX_PREFIX_POSITON_IN_ALIAS] !== this._indexPrefix || collectionName === HIDDEN_COLLECTION ) {
        continue;
      }

      if (!indexes[indexName]) {
        indexes[indexName] = {
          collections: [],
          name: indexName,
          size: 0,
        };
      }
      indexes[indexName].collections.push({
        documentCount: esIndexInfo.total.docs.count,
        name: collectionName,
        size: esIndexInfo.total.store.size_in_bytes,
      });
      indexes[indexName].size += esIndexInfo.total.store.size_in_bytes;
      size += esIndexInfo.total.store.size_in_bytes;
    }

    return {
      indexes: Object.values(indexes),
      size,
    };
  }

  /**
   * Scrolls results from previous elasticsearch query.
   * Automatically clears the scroll context after the last result page has
   * been fetched.
   *
   * @param {String} scrollId - Scroll identifier
   * @param {Object} options - scrollTTL (default scrollTTL)
   *
   * @returns {Promise.<{ scrollId, hits, aggregations, total }>}
   */
  async scroll (scrollId, { scrollTTL } = {}) {
    const _scrollTTL = scrollTTL || this._config.defaults.scrollTTL;
    const esRequest = {
      scroll: _scrollTTL,
      scrollId,
    };

    const cacheKey = SCROLL_CACHE_PREFIX + global.kuzzle.hash(esRequest.scrollId);

    debug('Scroll: %o', esRequest);

    if (_scrollTTL) {
      const scrollDuration = ms(_scrollTTL);

      if (scrollDuration > this.maxScrollDuration) {
        throw kerror.get('scroll_duration_too_great', _scrollTTL);
      }
    }

    let fetched = await global.kuzzle.ask('core:cache:internal:get', cacheKey);

    if (!fetched) {
      throw kerror.get('unknown_scroll_id');
    }

    fetched = Number.parseInt(fetched);

    try {
      const { body } = await this._client.scroll(esRequest);

      fetched += body.hits.hits.length;

      if (fetched >= body.hits.total.value) {
        debug('Last scroll page fetched: deleting scroll %s', body._scroll_id);
        await global.kuzzle.ask('core:cache:internal:del', cacheKey);
        await this.clearScroll(body._scroll_id);
      }
      else {
        await global.kuzzle.ask(
          'core:cache:internal:store',
          cacheKey,
          fetched,
          {
            ttl: ms(_scrollTTL) || this.scrollTTL,
          });
      }

      body.remaining = body.hits.total.value - fetched;

      return this._formatSearchResult(body);
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }
  }

  /**
   * Searches documents from elasticsearch with a query
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} searchBody - Search request body (query, sort, etc.)
   * @param {Object} options - from (undefined), size (undefined), scroll (undefined)
   *
   * @returns {Promise.<{ scrollId, hits, aggregations, suggest, total }>}
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
      size,
      trackTotalHits: true,
    };

    if (scroll) {
      const scrollDuration = ms(scroll);

      if (scrollDuration > this.maxScrollDuration) {
        throw kerror.get('scroll_duration_too_great', scroll);
      }
    }

    debug('Search: %j', esRequest);

    try {
      const { body } = await this._client.search(esRequest);

      if (body._scroll_id) {
        const ttl = esRequest.scroll && ms(esRequest.scroll)
          || ms(this._config.defaults.scrollTTL);

        await global.kuzzle.ask(
          'core:cache:internal:store',
          SCROLL_CACHE_PREFIX + global.kuzzle.hash(body._scroll_id),
          body.hits.hits.length,
          { ttl });

        body.remaining = body.hits.total.value - body.hits.hits.length;
      }

      return this._formatSearchResult(body);
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }
  }

  _formatSearchResult (body) {
    const hits = body.hits.hits.map(hit => ({
      _id: hit._id,
      _score: hit._score,
      _source: hit._source,
      highlight: hit.highlight,
    }));

    return {
      aggregations: body.aggregations,
      hits,
      remaining: body.remaining,
      scrollId: body._scroll_id,
      suggest: body.suggest,
      total: body.hits.total.value,
    };
  }

  /**
   * Gets the document with given ID
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document ID
   *
   * @returns {Promise.<{ _id, _version, _source }>}
   */
  async get (index, collection, id) {
    const esRequest = {
      id,
      index: this._getESIndex(index, collection)
    };

    // Just in case the user make a GET on url /mainindex/test/_search
    // Without this test we return something weird: a result.hits.hits with all
    // document without filter because the body is empty in HTTP by default
    if (esRequest.id === '_search') {
      return kerror.reject('search_as_an_id');
    }

    debug('Get document: %o', esRequest);

    try {
      const { body } = await this._client.get(esRequest);

      return {
        _id: body._id,
        _source: body._source,
        _version: body._version
      };
    }
    catch (error) {
      return this._esWrapper.reject(error);
    }
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
   * @returns {Promise.<{ items: Array<{ _id, _source, _version }>, errors }>}
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
  async count (index, collection, searchBody = {}) {
    const esRequest = {
      body: this._sanitizeSearchBody(searchBody),
      index: this._getESIndex(index, collection)
    };

    debug('Count: %o', esRequest);

    try {
      const { body } = await this._client.count(esRequest);
      return body.count;
    }
    catch (error) {
      return this._esWrapper.reject(error);
    }
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
      author: getKuid(userId),
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
  async createOrReplace (
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
        author: getKuid(userId),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updater: getKuid(userId)
      };
    }

    debug('Create or replace document: %o', esRequest);

    try {
      const { body } = await this._client.index(esRequest);

      return {
        _id: body._id,
        _source: esRequest.body,
        _version: body._version,
        created: body.result === 'created' // Needed by the notifier
      };
    }
    catch (error) {
      return this._esWrapper.reject(error);
    }
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
   * @returns {Promise.<{ _id, _version }>}
   */
  async update (
    index,
    collection,
    id,
    content,
    { refresh, userId=null, retryOnConflict } = {})
  {
    const esRequest = {
      _source: true,
      body: { doc: content },
      id,
      index: this._getESIndex(index, collection),
      refresh,
      retry_on_conflict: retryOnConflict || this._config.defaults.onUpdateConflictRetries
    };

    assertNoRouting(esRequest);
    assertWellFormedRefresh(esRequest);

    // Add metadata
    esRequest.body.doc._kuzzle_info = {
      updatedAt: Date.now(),
      updater: getKuid(userId)
    };

    debug('Update document: %o', esRequest);

    try {
      const { body } = await this._client.update(esRequest);
      return {
        _id: body._id,
        _source: body.get._source,
        _version: body._version
      };
    }
    catch (error) {
      return this._esWrapper.reject(error);
    }
  }

  /**
   * Sends the partial document to elasticsearch with the id to update
   * Creates the document if it doesn't already exist
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Object} content - Updated content
   * @param {Object} options - defaultValues ({}), refresh (undefined), userId (null), retryOnConflict (0)
   *
   * @returns {Promise.<{ _id, _version }>}
   */
  async upsert (
    index,
    collection,
    id,
    content,
    { defaultValues = {}, refresh, userId=null, retryOnConflict } = {})
  {
    const esRequest = {
      _source: true,
      body: {
        doc: content,
        upsert: { ...defaultValues, ...content },
      },
      id,
      index: this._getESIndex(index, collection),
      refresh,
      retry_on_conflict: retryOnConflict || this._config.defaults.onUpdateConflictRetries,
    };

    assertNoRouting(esRequest);
    assertWellFormedRefresh(esRequest);

    // Add metadata
    const user = getKuid(userId);
    const now = Date.now();

    esRequest.body.doc._kuzzle_info = {
      updatedAt: now,
      updater: user,
    };
    esRequest.body.upsert._kuzzle_info = {
      author: user,
      createdAt: now,
    };

    debug('Upsert document: %o', esRequest);

    try {
      const { body } = await this._client.update(esRequest);

      return {
        _id: body._id,
        _source: body.get._source,
        _version: body._version,
        created: body.result === 'created',
      };
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }
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
   * @returns {Promise.<{ _id, _version, _source }>}
   */
  async replace (
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
      author: getKuid(userId),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      updater: getKuid(userId)
    };

    try {
      const { body: exists } = await this._client.exists({ id, index: esIndex });

      if (! exists) {
        throw kerror.get('not_found', id, index, collection);
      }

      debug('Replace document: %o', esRequest);

      const { body } = await this._client.index(esRequest);

      return {
        _id: id,
        _source: esRequest.body,
        _version: body._version
      };
    }
    catch (error) {
      return this._esWrapper.reject(error);
    }
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
  async delete (
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

    try {
      await this._client.delete(esRequest);
    }
    catch (error) {
      return this._esWrapper.reject(error);
    }
    return null;
  }

  /**
   * Deletes all documents matching the provided filters.
   * If fetch=false, the max documents write limit is not applied.
   *
   * Options:
   *  - size: size of the batch to retrieve documents (no-op if fetch=false)
   *  - refresh: refresh option for ES
   *  - fetch: if true, will fetch the documents before delete them
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} query - Query to match documents
   * @param {Object} options - size (undefined), refresh (undefined), fetch (true)
   *
   * @returns {Promise.<{ documents, total, deleted, failures: Array<{ _shardId, reason }> }>}
   */
  async deleteByQuery (
    index,
    collection,
    query,
    { refresh, size = 1000, fetch=true } = {})
  {
    const esRequest = {
      body: this._sanitizeSearchBody({ query }),
      index: this._getESIndex(index, collection),
      scroll: '5s',
      size
    };

    if (!isPlainObject(query)) {
      throw kerror.get('missing_argument', 'body.query');
    }

    try {
      let documents = [];

      if (fetch) {
        documents = await this._getAllDocumentsFromQuery(esRequest);
      }

      debug('Delete by query: %o', esRequest);

      esRequest.refresh = refresh === 'wait_for' ? true : refresh;

      const { body } = await this._client.deleteByQuery(esRequest);

      return {
        deleted: body.deleted,
        documents,
        failures: body.failures
          .map(({ shardId, reason }) => ({ reason, shardId })),
        total: body.total,
      };
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }
  }

  /**
   * Delete fields of a document and replace it
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Array}  fields - Document fields to be removed
   * @param {Object} options - refresh (undefined), userId (null)
   *
   * @returns {Promise.<{ _id, _version, _source }>}
   */
  async deleteFields (
    index,
    collection,
    id,
    fields,
    { refresh, userId=null } = {})
  {
    const esIndex = this._getESIndex(index, collection);
    const esRequest = {
      id,
      index: esIndex,
    };

    try {
      debug('DeleteFields document: %o', esRequest);
      const { body } = await this._client.get(esRequest);

      for (const field of fields) {
        if (_.has(body._source, field)) {
          _.set(body._source, field, undefined);
        }
      }

      body._source._kuzzle_info = {
        ...body._source._kuzzle_info,
        updatedAt: Date.now(),
        updater: getKuid(userId)
      };

      const newEsRequest = {
        body: body._source,
        id,
        index: esIndex,
        refresh
      };

      assertNoRouting(newEsRequest);
      assertWellFormedRefresh(newEsRequest);

      const { body: updated } = await this._client.index(newEsRequest);

      return {
        _id: id,
        _source: body._source,
        _version: updated._version
      };
    } catch (error) {
      throw this._esWrapper.formatESError(error);
    }
  }

  /**
  * Updates all documents matching the provided filters
  *
  * @param {String} index - Index name
  * @param {String} collection - Collection name
  * @param {Object} query - Query to match documents
  * @param {Object} changes - Changes wanted on documents
  * @param {Object} options - refresh (undefined), size (undefined)
  *
  * @returns {Promise.<{ successes: [_id, _source, _status], errors: [ document, status, reason ] }>}
  */
  async updateByQuery (
    index,
    collection,
    query,
    changes,
    { refresh, size = 1000, userId=null } = {})
  {

    try {
      const esRequest = {
        body: this._sanitizeSearchBody({ query }),
        index: this._getESIndex(index, collection),
        scroll: '5s',
        size
      };

      const documents = await this._getAllDocumentsFromQuery(esRequest);

      for (let i = 0; i < documents.length; i++) {
        const document = documents[i];

        document._source = undefined;
        document.body = changes;
      }

      debug('Update by query: %o', esRequest);

      const { errors, items } = await this.mUpdate(
        index,
        collection,
        documents,
        { refresh, userId });

      return {
        errors,
        successes: items
      };
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }
  }

  /**
  * Updates all documents matching the provided filters
  *
  * @param {String} index - Index name
  * @param {String} collection - Collection name
  * @param {Object} query - Query to match documents
  * @param {Object} changes - Changes wanted on documents
  * @param {Object} options - refresh (undefined)
  *
  * @returns {Promise.<{ successes: [_id, _source, _status], errors: [ document, status, reason ] }>}
  */
  async bulkUpdateByQuery (
    index,
    collection,
    query,
    changes,
    { refresh = 'false' } = {})
  {
    const script = {
      params: {},
      source: ''
    };

    const flatChanges = extractFields(changes, { alsoExtractValues: true });

    for (const {key, value} of flatChanges) {
      script.source += `ctx._source.${key} = params['${key}'];`;
      script.params[key] = value;
    }

    const esRequest = {
      body: {
        query: this._sanitizeSearchBody({ query }).query,
        script,
      },
      index: this._getESIndex(index, collection),
      refresh
    };

    debug('Bulk Update by query: %o', esRequest);

    let response;
    try {
      response = await this._client.updateByQuery(esRequest);
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }

    if (response.body.failures.length) {
      const errors = response.body.failures
        .map(({ shardId, reason }) => ({ reason, shardId }));

      throw kerror.get('incomplete_update', response.body.updated, errors);
    }

    return {
      updated: response.body.updated
    };
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
  async mExecute (
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

    if (! isPlainObject(query)) {
      throw kerror.get('missing_argument', 'body.query');
    }

    const client = this._client;
    let results = [];

    let processed = 0;
    let scrollId = null;

    try {
      results = await new Bluebird((resolve, reject) => {
        this._client.search(
          esRequest,
          async function getMoreUntilDone(error, { body: { hits, _scroll_id } }) {
            if (error) {
              reject(error);
              return;
            }

            scrollId = _scroll_id;

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
    finally {
      this.clearScroll(scrollId);
    }

    return results;
  }

  /**
   * Creates a new index.
   *
   * This methods creates an hidden collection in the provided index to be
   * able to list it.
   * This methods resolves if the index name does not already exists either as
   * private or public index.
   *
   * @param {String} index - Index name
   *
   * @returns {Promise}
   */
  async createIndex (index) {
    this._assertValidIndexAndCollection(index);

    let body;

    try {
      ({ body } = await this._client.cat.aliases({ format: 'json' })); // NOSONAR
    }
    catch (e) {
      return this._esWrapper.reject(e);
    }

    const esIndexes = body.map(({ alias: name }) => name);
    for (const esIndex of esIndexes) {
      const indexName = this._extractIndex(esIndex);

      if (index === indexName) {
        const indexType = esIndex[INDEX_PREFIX_POSITON_IN_ALIAS] === PRIVATE_PREFIX
          ? 'private'
          : 'public';

        throw kerror.get('index_already_exists', indexType, index);
      }
    }

    await this._createHiddenCollection(index);

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

    if (collection === HIDDEN_COLLECTION) {
      throw kerror.get('collection_reserved', HIDDEN_COLLECTION);
    }

    const mutex = new Mutex(`hiddenCollection/create/${index}`);
    try {
      await mutex.lock();

      if (await this._hasHiddenCollection(index)) {
        await this.deleteCollection(index, HIDDEN_COLLECTION);
      }
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }
    finally {
      await mutex.unlock();
    }

    const esRequest = {
      aliases: {
        [this._getESIndex(index, collection)]: {}
      },
      body: {
        mappings: {},
        settings
      },
      index: await this._getSafeESIndex(index, collection),
    };

    this._checkDynamicProperty(mappings);

    const exists = await this.hasCollection(index, collection);
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
   * @returns {Promise.<{ dynamic, _meta, properties }>}
   */
  async getMapping (index, collection, { includeKuzzleMeta=false } = {}) {
    const
      esIndex = this._getESIndex(index, collection),
      esRequest = {
        index: esIndex
      };

    debug('Get mapping: %o', esRequest);

    try {
      const { body } = await this._client.indices.getMapping(esRequest);

      const properties = includeKuzzleMeta
        ? body[esIndex].mappings.properties
        : _.omit(body[esIndex].mappings.properties, '_kuzzle_info');

      return {
        _meta: body[esIndex].mappings._meta,
        dynamic: body[esIndex].mappings.dynamic,
        properties
      };
    }
    catch (error) {
      return this._esWrapper.reject(error);
    }
  }

  /**
   * Updates a collection mappings and settings
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} config - mappings ({}), settings ({})
   *
   * @returns {Promise}
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
        const previousMappings = await this.getMapping(index, collection);

        await this.updateMapping(index, collection, mappings);

        if (this._dynamicChanges(previousMappings, mappings)) {
          await this.updateSearchIndex(index, collection);
        }
      }
    }
    catch (error) {
      const allowedSettings = {
        index: _.omit(
          esIndexSettings.index,
          ['creation_date', 'provided_name', 'uuid', 'version'])
      };

      // Rollback to previous settings
      if (!_.isEmpty(settings)) {
        await this.updateSettings(index, collection, allowedSettings);
      }

      throw error;
    }

    return null;
  }

  /**
  * Sends an empty UpdateByQuery request to update the search index
  *
  * @param {String} index - Index name
  * @param {String} collection - Collection name
  * @returns {Promise.<Object>} {}
  */
  async updateSearchIndex (index, collection) {
    const esRequest = {
      body: {},
      // @cluster: conflicts when two nodes start at the same time
      conflicts: 'proceed',
      index: this._getESIndex(index, collection),
      refresh: true,
      // This operation can take some time: this should be an ES
      // background task. And it's preferable to a request timeout when
      // processing large indexes.
      waitForCompletion: false,
    };

    debug('UpdateByQuery: %o', esRequest);

    try {
      await this._client.updateByQuery(esRequest);
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }
  }

  /**
   * Update a collection mappings
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object} mappings - Collection mappings in ES format
   *
   * @returns {Promise.<{ dynamic, _meta, properties }>}
   */
  async updateMapping (index, collection, mappings = {}) {
    const esRequest = {
      index: this._getESIndex(index, collection)
    };

    this._checkDynamicProperty(mappings);

    const collectionMappings = await this.getMapping(index, collection, true);

    this._checkMappings(mappings);

    esRequest.body = {
      _meta: mappings._meta || collectionMappings._meta,
      dynamic: mappings.dynamic || collectionMappings.dynamic,
      properties: mappings.properties
    };

    debug('Update mapping: %o', esRequest);

    try {
      await this._client.indices.putMapping(esRequest);
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }

    const fullProperties = _.merge(
      collectionMappings.properties,
      mappings.properties);

    return {
      _meta: esRequest.body._meta,
      dynamic: esRequest.body.dynamic,
      properties: fullProperties
    };
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
      index: this._getESIndex(index, collection)
    };

    await this._client.indices.close(esRequest);

    try {
      await this._client.indices.putSettings({ ...esRequest, body: settings });
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }
    finally {
      await this._client.indices.open(esRequest);
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
  async truncateCollection (index, collection) {
    let mappings;

    const esRequest = {
      index: await this._getESIndexFromAlias(index, collection)
    };

    try {
      mappings = await this.getMapping(index, collection, { includeKuzzleMeta: true });

      await this._client.indices.delete(esRequest);

      await this._client.indices.create({
        ...esRequest,
        aliases: {
          [this._getESIndex(index, collection)]: {}
        },
        body: { mappings },
      });

      return null;
    }
    catch (error) {
      return this._esWrapper.reject(error);
    }
  }

  /**
   * Runs several action and document
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object[]} documents - Documents to import
   * @param {Object} options - timeout (undefined), refresh (undefined), userId (null)
   *
   * @returns {Promise.<{ items, errors }>
   */
  async import (
    index,
    collection,
    documents,
    { refresh, timeout, userId=null } = {})
  {
    const esIndex = this._getESIndex(index, collection);
    const actionNames = ['index', 'create', 'update', 'delete'];
    const dateNow = Date.now();
    const esRequest = {
      body: documents,
      refresh,
      timeout
    };
    const kuzzleMeta = {
      created: {
        author: getKuid(userId),
        createdAt: dateNow,
        updatedAt: null,
        updater: null
      },
      updated: {
        updatedAt: dateNow,
        updater: getKuid(userId)
      }
    };

    assertWellFormedRefresh(esRequest);
    this._scriptCheck(documents);

    let lastAction; // NOSONAR

    /**
     * @warning Critical code section
     *
     * bulk body can contain more than 10K elements
     */
    for (let i = 0; i < esRequest.body.length; i++) {
      const item = esRequest.body[i];
      const action = Object.keys(item)[0];

      if (actionNames.indexOf(action) !== -1) {
        lastAction = action;

        item[action]._index = esIndex;

        if (item[action]._type) {
          item[action]._type = undefined;
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

    let response;
    try {
      response = await this._client.bulk(esRequest);
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }

    const body = response.body;

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
      const row = body.items[i];
      const action = Object.keys(row)[0];
      const item = row[action];

      if (item.status >= 400) {
        const error = {
          _id: item._id,
          status: item.status
        };

        // update action contain body in "doc" field
        // the delete action is not followed by an action payload
        if (action === 'update') {
          error._source = documents[idx + 1].doc;
          error._source._kuzzle_info = undefined;
        }
        else if (action !== 'delete') {
          error._source = documents[idx + 1];
          error._source._kuzzle_info = undefined;
        }

        // ES response does not systematicaly include an error object
        // (e.g. delete action with 404 status)
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
  }

  /**
   * Retrieves the complete list of existing collections in the current index
   *
   * @param {String} index - Index name
   * @param {Object.Boolean} includeHidden - Optional: include HIDDEN_COLLECTION in results
   *
   * @returns {Promise.<Array>} Collection names
   */
  async listCollections (index, { includeHidden = false } = {}) {
    let body;

    try {
      ({ body } = await this._client.cat.aliases({ format: 'json' }));
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }

    const esIndexes = body.map(({ alias: esIndex }) => esIndex);

    const schema = this._extractSchema(esIndexes, { includeHidden });

    return schema[index] || [];
  }

  /**
   * Retrieves the complete list of indexes
   *
   * @returns {Promise.<Array>} Index names
   */
  async listIndexes () {
    let body;

    try {
      ({ body } = await this._client.cat.aliases({ format: 'json' }));
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }

    const esIndexes = body.map(({ alias: index }) => index);

    const schema = this._extractSchema(esIndexes);

    return Object.keys(schema);
  }

  /**
   * Returns an object containing the list of indexes and collections
   *
   * @returns {Object.<String, String[]>} Object<index, collections>
   */
  async getSchema () {
    // This check avoids a breaking change for those who were using Kuzzle before
    // alias attribution for each ES index was the standard ('auto-version')
    await this._ensureAliasConsistency();

    let body;
    try {
      ({ body } = await this._client.cat.aliases({ format: 'json' }));
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }

    const esIndexes = body.map(({ alias: index }) => index);

    const schema = this._extractSchema(esIndexes, { includeHidden: true });

    for (const [index, collections] of Object.entries(schema)) {
      schema[index] = collections.filter(c => c !== HIDDEN_COLLECTION);
    }

    return schema;
  }

  /**
   * Retrieves the complete list of aliases
   *
   * @returns {Promise.<Object[]>} [ { name, index, collection } ]
   */
  async listAliases () {
    let body;

    try {
      ({ body } = await this._client.cat.aliases({ format: 'json' }));
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }

    const aliases = [];

    for (const { alias, index: esIndex } of body) {
      if (alias[INDEX_PREFIX_POSITON_IN_ALIAS] === this._indexPrefix) {
        aliases.push({
          collection: this._extractCollection(alias),
          index: this._extractIndex(alias),
          name: esIndex,
        });
      }
    }
    return aliases;
  }

  /**
   * Deletes a collection
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   *
   * @returns {Promise}
   */
  async deleteCollection (index, collection) {
    const esRequest = {
      index: await this._getESIndexFromAlias(index, collection)
    };

    const mutex = new Mutex(`hiddenCollection/delete/${index}`);
    try {
      await this._client.indices.delete(esRequest);

      await mutex.lock();

      if (! await this._hasHiddenCollection(index)) {
        await this._createHiddenCollection(index);
      }
    }
    catch (e) {
      throw this._esWrapper.formatESError(e);
    }
    finally {
      await mutex.unlock();
    }

    return null;
  }

  /**
   * Deletes multiple indexes
   *
   * @param {String[]} indexes - Index names
   *
   * @returns {Promise.<String[]>}
   */
  async deleteIndexes (indexes = []) {
    if (indexes.length === 0) {
      return Bluebird.resolve([]);
    }
    const deleted = new Set();

    try {
      const { body } = await this._client.cat.aliases({ format: 'json' });

      const esRequest = body.reduce((request, { alias, index: esIndex }) => {
        const index = this._extractIndex(alias);

        if (alias[INDEX_PREFIX_POSITON_IN_ALIAS] !== this._indexPrefix || ! indexes.includes(index)) {
          return request;
        }

        deleted.add(index);
        request.index.push(esIndex);

        return request;
      }, { index: [] });

      debug('Delete indexes: %o', esRequest);

      await this._client.indices.delete(esRequest);
    }
    catch (error) {
      return this._esWrapper.reject(error);
    }

    return Array.from(deleted);
  }

  /**
   * Deletes an index
   *
   * @param {String} index - Index name
   *
   * @returns {Promise}
   */
  async deleteIndex (index) {
    await this.deleteIndexes([index]);
    return null;
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
  async refreshCollection (index, collection) {
    const esRequest = {
      index: this._getESIndex(index, collection),
    };

    let _shards;

    try {
      ({ body: { _shards } } = await this._client.indices.refresh(esRequest));
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }

    return { _shards };
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
  async exists (index, collection, id) {
    const esRequest = {
      id,
      index: this._getESIndex(index, collection)
    };

    try {
      const { body: exists} = await this._client.exists(esRequest);

      return exists;
    }
    catch (error) {
      return this._esWrapper.reject(error);
    }
  }

  /**
   * Returns true if the index exists
   *
   * @param {String} index - Index name
   *
   * @returns {Promise.<boolean>}
   */
  async hasIndex (index) {
    const indexes = await this.listIndexes();

    return indexes.some(idx => idx === index);
  }

  /**
   * Returns true if the collection exists
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   *
   * @returns {Promise.<boolean>}
   */
  async hasCollection (index, collection) {
    const collections = await this.listCollections(index);

    return collections.some(col => col === collection);
  }

  /**
   * Returns true if the index has the hidden collection
   *
   * @param {String} index - Index name
   *
   * @returns {Promise.<boolean>}
   */
  async _hasHiddenCollection (index) {
    const collections = await this.listCollections(index, { includeHidden: true });

    return collections.some(col => col === HIDDEN_COLLECTION);
  }

  /**
   * Creates multiple documents at once.
   * If a content has no id, one is automatically generated and assigned to it.
   * If a content has a specified identifier, it is rejected if it already exists
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object[]} documents - Documents
   * @param {Object} options - timeout (undefined), refresh (undefined), userId (null)
   *
   * @returns {Promise.<Object>} { items, errors }
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
          author: getKuid(userId),
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
          document._source._kuzzle_info = undefined;

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
   * @param {Object[]} documents - Documents
   * @param {Object} options - timeout (undefined), refresh (undefined), userId (null), injectKuzzleMeta (false), limits (true)
   *
   * @returns {Promise.<{ items, errors }>
   */
  async mCreateOrReplace (
    index,
    collection,
    documents,
    { refresh, timeout, userId=null, injectKuzzleMeta=true, limits=true } = {})
  {
    let kuzzleMeta = {};

    if (injectKuzzleMeta) {
      kuzzleMeta = {
        _kuzzle_info: {
          author: getKuid(userId),
          createdAt: Date.now(),
          updatedAt: null,
          updater: null
        }
      };
    }

    const esIndex = this._getESIndex(index, collection);
    const esRequest = {
      body: [],
      index: esIndex,
      refresh,
      timeout
    };
    const {
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

    return this._mExecute(esRequest, extractedDocuments, rejected, { limits });
  }

  /**
   * Updates multiple documents with one request
   * Replacements are rejected if targeted documents do not exist
   * (like with the normal "update" method)
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object[]} documents - Documents
   * @param {Object} options - timeout (undefined), refresh (undefined), retryOnConflict (0), userId (null)
   *
   * @returns {Promise.<Object>} { items, errors }
   */
  async mUpdate (
    index,
    collection,
    documents,
    { refresh, retryOnConflict = 0, timeout, userId=null } = {})
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
          updater: getKuid(userId)
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
            _index: esIndex,
            retry_on_conflict: retryOnConflict || this._config.defaults.onUpdateConflictRetries
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
        extractedDocument._source._kuzzle_info = undefined;

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
      _version: item._version,
      status: item.status
    }));

    return response;
  }

  /**
   * Creates or replaces multiple documents at once.
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Object[]} documents - Documents
   * @param {Object} options - refresh (undefined), retryOnConflict (0), timeout (undefined), userId (null)
   *
   * @returns {Promise.<{ items, errors }>
   */
  async mUpsert (
    index,
    collection,
    documents,
    { refresh, retryOnConflict = 0, timeout, userId=null } = {})
  {
    const esIndex = this._getESIndex(index, collection);
    const esRequest = {
      body: [],
      refresh,
      timeout
    };

    const user = getKuid(userId);
    const now = Date.now();
    const kuzzleMeta = {
      doc: {
        _kuzzle_info: {
          updatedAt: now,
          updater: user
        }
      },
      upsert: {
        _kuzzle_info: {
          author: user,
          createdAt: now
        }
      }
    };

    const { rejected, extractedDocuments } = this._extractMDocuments(
      documents,
      kuzzleMeta,
      {
        prepareMUpsert: true,
        requireId: true
      }
    );

    /**
     * @warning Critical code section
     *
     * request can contain more than 10K elements
     */
    for (let i = 0; i < extractedDocuments.length; i++) {
      esRequest.body.push(
        {
          update: {
            _id: extractedDocuments[i]._id,
            _index: esIndex,
            _source: true,
            retry_on_conflict: retryOnConflict || this._config.defaults.onUpdateConflictRetries
          }
        },
        {
          doc: extractedDocuments[i]._source.changes,
          upsert: extractedDocuments[i]._source.default
        }
      );
      // _source: true
      // Makes ES return the updated document source in the response.
      // Required by the real-time notifier component
    }
    /* end critical code section */

    const response = await this._mExecute(esRequest, extractedDocuments, rejected);

    // with _source: true, ES returns the updated document in
    // response.result.get._source
    // => we replace response.result._source with it so that the notifier
    // module can seamlessly process all kind of m* response*
    response.items = response.items.map(item => ({
      _id: item._id,
      _source: item.get._source,
      _version: item._version,
      created: item.result === 'created', // Needed by the notifier
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
   * @param {Object[]} documents - Documents
   * @param {Object} options - timeout (undefined), refresh (undefined), userId (null)
   *
   * @returns {Promise.<Object>} { items, errors }
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
          author: getKuid(userId),
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
        document._source._kuzzle_info = undefined;

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
   * @returns {Promise.<{ documents, errors }>
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
    await this.refreshCollection(index, collection);

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
    const { documents } = await this.deleteByQuery(
      index,
      collection,
      query,
      { refresh, timeout });

    return { documents, errors: partialErrors };
  }

  /**
   * Executes an ES request prepared by mcreate, mupdate, mreplace, mdelete or mwriteDocuments
   * Returns a standardized ES response object, containing the list of
   * successfully performed operations, and the rejected ones
   *
   * @param  {Object} esRequest - Elasticsearch request
   * @param  {Object[]} documents - Document sources (format: {_id, _source})
   * @param  {Object[]} partialErrors - pre-rejected documents
   * @param  {Object} options - limits (true)
   *
   * @returns {Promise.<Object[]>} results
   */
  async _mExecute (esRequest, documents, partialErrors, { limits=true } = {}) {
    assertWellFormedRefresh(esRequest);

    if ( limits
      && documents.length > global.kuzzle.config.limits.documentsWriteCount
    ) {
      return kerror.reject('write_limit_exceeded');
    }

    let response = { body: { items: [] } };

    if (documents.length > 0) {
      try {
        response = await this._client.bulk(esRequest);
      }
      catch (error) {
        throw this._esWrapper.formatESError(error);
      }
    }

    const body = response.body;
    const successes = [];

    /**
     * @warning Critical code section
     *
     * request can contain more than 10K elements
     */
    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      const result = item[Object.keys(item)[0]];

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
      }
      else {
        successes.push({
          _id: result._id,
          _source: documents[i]._source,
          _version: result._version,
          created: result.result === 'created',
          get: result.get,
          result: result.result,
          status: result.status, // used by mUpdate to get the full document body
        });
      }
    }
    /* end critical code section */

    return {
      errors: partialErrors, // @todo rename items to documents
      items: successes,
    };
  }

  /**
   * Extracts, injects metadata and validates documents contained
   * in a Request
   *
   * Used by mCreate, mUpdate, mUpsert, mReplace and mCreateOrReplace
   *
   * @param  {Object[]} documents - Documents
   * @param  {Object} metadata - Kuzzle metadata
   * @param  {Object} options - prepareMGet (false), requireId (false)
   *
   * @returns {Object} { rejected, extractedDocuments, documentsToGet }
   */
  _extractMDocuments (documents, metadata, { prepareMGet=false, requireId=false, prepareMUpsert=false } = {}) {
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

      if (!isPlainObject(document.body) && !prepareMUpsert) {
        rejected.push({
          document,
          reason: 'document body must be an object',
          status: 400
        });
      }
      else if (!isPlainObject(document.changes) && prepareMUpsert) {
        rejected.push({
          document,
          reason: 'document changes must be an object',
          status: 400
        });
      }
      else if (prepareMUpsert && document.default && !isPlainObject(document.default)) {
        rejected.push({
          document,
          reason: 'document default must be an object',
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
        let extractedDocument;
        if (prepareMUpsert) {
          extractedDocument = {
            _source: {
              // Do not use destructuring, it's 10x slower
              changes: Object.assign({}, metadata.doc, document.changes),
              default: Object.assign({}, metadata.upsert, document.changes, document.default)
            }
          };
        }
        else {
          extractedDocument = {
            // Do not use destructuring, it's 10x slower
            _source: Object.assign({}, metadata, document.body)
          };
        }


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
        ? ROOT_MAPPING_PROPERTIES
        : [...ROOT_MAPPING_PROPERTIES, ...CHILD_MAPPING_PROPERTIES];

    for (const property of properties) {
      if (check && !mappingProperties.includes(property)) {
        const currentPath = [...path, property].join('.');

        throw kerror.get(
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
   * Given index + collection, returns the well formated esIndex alias name
   *
   * @param {String} index
   * @param {String} collection
   *
   * @returns {String} esIndex name (eg: '@&nepali.liia')
   */
  _getESIndex (index, collection) {
    return `${ALIAS_PREFIX}${this._indexPrefix}${index}${NAME_SEPARATOR}${collection}`;
  }

  /**
   * Gets the concrete esIndex name from an alias (index + collection)
   *
   * @param {String} index
   * @param {String} collection
   *
   * @returns {String} esIndex name (eg: '&nepali.liia')
   * @throws If there is not exactly one esIndex related to this alias (index + collection)
   */
  async _getESIndexFromAlias (index, collection) {
    const alias = `${ALIAS_PREFIX}${this._indexPrefix}${index}${NAME_SEPARATOR}${collection}`;
    const { body } = await this._client.cat.aliases({ format: 'json', name: alias });

    if (body.length < 1) {
      throw kerror.get('unknown_index_collection');
    }
    else if (body.length > 1) {
      throw kerror.get('multiple_index_alias', 'alias', 'index');
    }

    return body[0].index;
  }

  /**
   * Gets the alias name from a concrete esIndex
   *
   * @param {String} esIndex
   *
   * @returns {String} alias name (eg: '@&nepali.liia')
   * @throws If there is not exactly one alias related to this esIndex
   */
  async _getAliasFromESIndex (esIndex) {
    const { body } = await this._client.indices.getAlias({ index: esIndex});
    const aliases = Object.keys(body[esIndex].aliases);

    if (aliases.length < 1) {
      throw kerror.get('unknown_index_collection');
    }
    else if (aliases.length > 1) {
      throw kerror.get('multiple_index_alias', 'index', 'alias');
    }

    return aliases[0];
  }

  /**
   * Gets the concrete esIndex name from an alias (index + collection)
   *
   * @param {String} esIndex
   *
   * @returns {boolean} `true` if the raw ES index name is available, `false` otherwise
   */
  async _isESIndexAvailable (esIndex) {
    const { body } = await this._client.indices.get({ index: esIndex });

    return body.length === 0;
  }

  /**
   * Gets the concrete esIndex name from an alias (index + collection)
   *
   * @param {String} index
   * @param {String} collection Default to `HIDDEN_COLLECTION`
   *
   * @returns {String} Available esIndex name (eg: '&nepali.liia')
   */
  async _getSafeESIndex (index, collection = HIDDEN_COLLECTION) {
    let esIndex = this._getESIndex(index, collection).substr(INDEX_PREFIX_POSITON_IN_ALIAS);
    let available = await this._isESIndexAvailable(esIndex);

    while (! available) {
      esIndex = generateRandomCustom(
        (adjective, name) => `${this._indexPrefix}${adjective}${NAME_SEPARATOR}${name}`);

      available = Buffer.from(esIndex).length < 255 && await this._isESIndexAvailable(esIndex);
    }

    return esIndex;
  }

  /**
   * Check for each ES index whether it has an alias or not.
   * When the latter is missing, create one based on the actual index name.
   *
   * This check avoids a breaking change for those who were using Kuzzle before
   * alias attribution for each ES index turned into a standard ('auto-version').
   */
  async _ensureAliasConsistency () {
    try {
      const { body } = await this._client.cat.indices({ format: 'json' });
      const esIndexes = body.map(({ index }) => index);
      const aliases = await this.listAliases();

      const indexesWithoutAlias = esIndexes.filter((index) =>
        index[INDEX_PREFIX_POSITON_IN_INDEX] === this._indexPrefix
        && ! aliases.some((alias) => alias.name === index));

      let esRequest = { actions : [] };
      for (const index of indexesWithoutAlias) {
        esRequest.actions.push({ add : { alias: `@${index}`, index } });
      }

      await this._client.indices.updateAliases(esRequest);
    }
    catch (error) {
      throw this._esWrapper.formatESError(error);
    }
  }

  /**
   * Throws if index or collection includes forbidden characters
   *
   * @param {String} index
   * @param {String} collection
   */
  _assertValidIndexAndCollection (index, collection = null) {
    if (!this.isIndexNameValid(index)) {
      throw kerror.get('invalid_index_name', index);
    }

    if (collection !== null && !this.isCollectionNameValid(collection)) {
      throw kerror.get('invalid_collection_name', collection);
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
    let prefixPosition = esIndex.search(ALIAS_PREFIX) === -1
      ? INDEX_PREFIX_POSITON_IN_INDEX
      : INDEX_PREFIX_POSITON_IN_ALIAS;

    return esIndex.substr(
      prefixPosition + 1,
      esIndex.indexOf(NAME_SEPARATOR) - prefixPosition -1 );
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
   * Returns an object containing index names as keys and their collections
   * as value.
   *
   * @param {Array.<String>} esIndexes
   * @param {Object.Boolean} includeHidden
   *
   * @returns {Object.<String, String[]>} indexes and their collections
   */
  _extractSchema (esIndexes, { includeHidden = false } = {}) {
    const schema = {};

    for (const esIndex of esIndexes) {
      const [ indexName, collectionName ] = esIndex
        .substr(esIndex.indexOf(this._indexPrefix) + 1, esIndex.length)
        .split(NAME_SEPARATOR);

      if ( esIndex[INDEX_PREFIX_POSITON_IN_ALIAS] === this._indexPrefix
        && (collectionName !== HIDDEN_COLLECTION || includeHidden)
      ) {
        if (! schema[indexName]) {
          schema[indexName] = [];
        }

        if (! schema[indexName].includes(collectionName)) {
          schema[indexName].push(collectionName);
        }
      }
    }

    return schema;
  }

  /**
   * Creates the hidden collection on the provided index.
   *
   * @param {String} index Index name
   */
  async _createHiddenCollection (index) {

    try {
      await this._client.indices.create({
        aliases: {
          [this._getESIndex(index, HIDDEN_COLLECTION)]: {}
        },
        body: {
          settings: {
            number_of_replicas: 1,
            number_of_shards: 1,
          }
        },
        index: await this._getSafeESIndex(index),
      });
    }
    catch (e) {
      throw this._esWrapper.formatESError(e);
    }
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

    if (hits.total.value > global.kuzzle.config.limits.documentsWriteCount) {
      throw kerror.get('write_limit_exceeded');
    }

    let documents = hits.hits.map(h => ({ _id: h._id, _source: h._source }));

    while (hits.total.value !== documents.length) {
      ({ body: { hits, _scroll_id } } = await this._client.scroll({
        scroll: esRequest.scroll,
        scrollId: _scroll_id
      }));

      documents = documents.concat(hits.hits.map(h => ({
        _id: h._id,
        _source: h._source
      })));
    }

    await this.clearScroll(_scroll_id);

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
        throw kerror.get('invalid_search_query', key);
      }
    }

    // Ensure that the body does not include a script
    this._scriptCheck(searchBody);

    // Avoid empty queries that causes ES to respond with an error.
    // Empty queries are turned into match_all queries
    if (_.isEmpty(searchBody.query)) {
      searchBody.query = { match_all: {} };
    }

    return searchBody;
  }

  /**
   * Throw if any script keyword is contained in the object
   *
   * @param {Object} object
   */
  _scriptCheck(object) {
    for (const [key, value] of Object.entries(object)) {
      if (this.scriptKeys.includes(key)) {
        throw kerror.get('invalid_query_keyword', key);
      }
      // Every object must be checked here, even the ones nested into an array
      else if (typeof value === 'object' && value !== null) {
        this._scriptCheck(value);
      }
    }
  }

  /**
   * Checks if a collection name is valid
   * @param  {string}  name
   * @returns {Boolean}
   */
  isCollectionNameValid (name) {
    return _isObjectNameValid(name);
  }

  /**
   * Checks if a collection name is valid
   * @param  {string}  name
   * @returns {Boolean}
   */
  isIndexNameValid (name) {
    return _isObjectNameValid(name);
  }

  /**
   * Clears an allocated scroll
   * @param  {[type]} id [description]
   * @returns {[type]}    [description]
   */
  async clearScroll (id) {
    if (id) {
      debug('clearing scroll: %s', id);
      await this._client.clearScroll({scrollId: id});
    }
  }

  /**
   * Loads a configuration value from services.storageEngine and assert a valid
   * ms format.
   *
   * @param {String} key - relative path to the key in configuration
   *
   * @returns {Number} milliseconds
   */
  _loadMsConfig (key) {
    const configValue = _.get(this._config, key);

    assert(
      typeof configValue === 'string',
      `services.storageEngine.${key} must be a string.`);

    const parsedValue = ms(configValue);

    assert(
      typeof parsedValue === 'number',
      `Invalid parsed value from ms() for services.storageEngine.${key} ("${typeof parsedValue}").`);

    return parsedValue;
  }

  /**
   * Returns true if one of the mappings dynamic property changes value from
   * false to true
   */
  _dynamicChanges (previousMappings, newMappings) {
    const previousValues = findDynamic(previousMappings);

    for (const [path, previousValue] of Object.entries(previousValues)) {
      if (previousValue.toString() !== 'false') {
        continue;
      }

      const newValue = _.get(newMappings, path);

      if (newValue && newValue.toString() !== 'false') {
        return true;
      }
    }

    return false;
  }

  async waitForElasticsearch () {
    if (esState !== esStateEnum.NONE) {
      while (esState !== esStateEnum.OK) {
        await Bluebird.delay(1000);
      }

      return;
    }

    esState = esStateEnum.AWAITING;

    global.kuzzle.log.info('[ℹ] Trying to connect to Elasticsearch...');

    while (esState !== esStateEnum.OK) {
      try {
        // Wait for at least 1 shard to be initialized
        const health = await this._client.cluster.health({
          waitForNoInitializingShards: true,
        });

        if (health.body.number_of_pending_tasks === 0) {
          global.kuzzle.log.info('[✔] Elasticsearch is ready');
          esState = esStateEnum.OK;
        }
        else {
          global.kuzzle.log.info(`[ℹ] Still waiting for Elasticsearch: ${health.body.number_of_pending_tasks} cluster tasks remaining`);
          await Bluebird.delay(1000);
        }
      }
      catch (e) {
        await Bluebird.delay(1000);
      }
    }
  }

  /**
   * Checks if the dynamic properties are correct
   */
  _checkDynamicProperty (mappings) {
    const dynamicProperties = findDynamic(mappings);
    for (const [path, value] of Object.entries(dynamicProperties)) {
      // Prevent common mistake
      if (typeof value === 'boolean') {
        _.set(mappings, path, value.toString());
      }
      else if (typeof value !== 'string') {
        throw kerror.get(
          'invalid_mapping',
          path,
          'Dynamic property value should be a string.');
      }

      if (! DYNAMIC_PROPERTY_VALUES.includes(value.toString())) {
        throw kerror.get(
          'invalid_mapping',
          path,
          `Incorrect dynamic property value (${value}). Should be one of "${DYNAMIC_PROPERTY_VALUES.join('", "')}"`);
      }
    }
  }
}

module.exports = ElasticSearch;

/**
 * Finds paths and values of mappings dynamic properties
 *
 * @example
 *
 * findDynamic(mappings);
 * {
 *   "properties.metadata.dynamic": "true",
 *   "properties.user.properties.address.dynamic": "strict"
 * }
 */
function findDynamic (mappings, path = [], results = {}) {
  if (mappings.dynamic !== undefined) {
    results[path.concat('dynamic').join('.')] = mappings.dynamic;
  }

  for (const [key, value] of Object.entries(mappings)) {
    if (isPlainObject(value)) {
      findDynamic(value, path.concat(key), results);
    }
  }

  return results;
}

/**
 * Forbids the use of the _routing ES option
 *
 * @param {Object} esRequest
 * @throws
 */
function assertNoRouting(esRequest) {
  if (esRequest.body._routing) {
    throw kerror.get('no_routing');
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
    throw kerror.get('invalid_argument', 'refresh', '"wait_for", false');
  }
}

function getKuid (userId) {
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
 * @returns {Boolean}
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

  if (name === '_all') {
    return false;
  }

  let valid = true;

  for (let i = 0; valid && i < FORBIDDEN_CHARS.length; i++) {
    valid = !name.includes(FORBIDDEN_CHARS[i]);
  }

  return valid;
}
