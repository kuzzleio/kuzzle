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

const Bluebird = require('bluebird');

const Elasticsearch = require('../../service/storage/elasticsearch');
const QueryTranslator = require('../../service/storage/queryTranslator');
const IndexCache = require('./indexCache');
const { isPlainObject } = require('../../util/safeObject');
const kerror = require('../../kerror');
const Mutex = require('../../util/mutex');

const servicesError = kerror.wrap('services', 'storage');

/**
 * Storage client adapter to perform validation on index/collection existence
 * and to maintain the index/collection cache.
 */
class ClientAdapter {
  /**
   * @param {Kuzzle} kuzzle
   * @param {storeScopeEnum} scope
   */
  constructor (kuzzle, scope) {
    this.kuzzle = kuzzle;
    this.client = new Elasticsearch(
      kuzzle,
      kuzzle.config.services.storageEngine,
      scope);
    this.scope = scope;
    this.cache = new IndexCache(kuzzle, scope);
  }

  async init () {
    await this.client.init();
    await this.populateCache();

    this.registerCollectionEvents();
    this.registerIndexEvents();
    this.registerDocumentEvents();
    this.registerMappingEvents();
    this.registerCacheEvents();

    // Global store events registration

    /**
     * Return information about the instantiated ES service
     * @returns {Promise.<Object>}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:info:get`,
      () => this.client.info());

    /**
     * Translate Koncorde filters to Elasticsearch query
     *
     * @param {Object} koncordeFilters - Set of valid Koncorde filters
     * @returns {Object} Equivalent Elasticsearch query
     */
    this.kuzzle.onAsk(`core:storage:${this.scope}:translate`, filters => (
      this.client.translateKoncordeFilters(filters)
    ));
  }

  async createIndex (index) {
    if (this.cache.hasIndex(index)) {
      throw servicesError.get('index_already_exists', this.scope, index);
    }

    await this.client.createIndex(index);

    this.cache.addIndex(index);
  }

  async createCollection (index, collection, opts) {
    await this.client.createCollection(index, collection, opts);

    this.cache.addCollection(index, collection);
  }

  async deleteIndex (index) {
    this.cache.assertIndexExists(index);

    await this.client.deleteIndex(index);

    this.cache.removeIndex(index);
  }

  async deleteIndexes (indexes) {
    for (const index of indexes) {
      this.cache.assertIndexExists(index);
    }

    const deleted = await this.client.deleteIndexes(indexes);

    for (const index of deleted) {
      this.cache.removeIndex(index);
    }

    return deleted;
  }

  async deleteCollection (index, collection) {
    this.cache.assertCollectionExists(index, collection);

    await this.client.deleteCollection(index, collection);

    this.cache.removeCollection(index, collection);
  }

  /**
   * Populates the index cache with existing index/collection and aliases.
   * Also checks for duplicated index names.
   *
   * @returns {Promise}
   */
  async populateCache () {
    const indexes = await this.client.listIndexes();

    await Bluebird.map(indexes, async index => {
      this.cache.addIndex(index, { notify: false });

      for (const collection of await this.client.listCollections(index)) {
        this.cache.addCollection(index, collection, { notify: false });
      }
    });

    const aliases = await this.client.listAliases();

    for (const { collection, index } of aliases) {
      this.cache.addCollection(index, collection, { notify: false });
    }
  }

  registerCollectionEvents () {
    /**
     * Create a new collection in a given index, and optionally configure it
     * @param {string} index
     * @param {string} collection
     * @param {Object.<settings: {}, mappings: {}} [opts]
     * @return {Promise}
     * @throws
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:collection:create`,
      (index, collection, opts) => this.createCollection(index, collection, opts));

    /**
     * Delete a collection
     * @param {string} index
     * @param {string} collection
     * @return {Promise}
     * @throws If the index or the collection does not exist
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:collection:delete`,
      (index, collection) => this.deleteCollection(index, collection));

    /**
     * Check a collection existence
     * @param {string} index
     * @param {string} collection
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:collection:exist`,
      (index, collection) => this.cache.hasCollection(index, collection));

    /**
     * Return a list of an index' collections within this adapter's scope
     * @param {string} index
     * @returns {Promise.<string[]>}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:collection:list`,
      index => this.cache.listCollections(index));

    /**
     * Refresh a collection
     * @param {string} index
     * @param {string} collection
     * @returns {Promise}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:collection:refresh`,
      (index, collection) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.refreshCollection(index, collection);
      });

    /**
     * Remove all documents from an existing collection
     * @param {string} index
     * @param {string} collection
     * @returns {Promise}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:collection:truncate`,
      (index, collection) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.truncateCollection(index, collection);
      });

    /**
     * Update a collection settings and mappings
     * @param {string} index
     * @param {string} collection
     * @param {Object} changes
     * @returns {Promise}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:collection:update`,
      (index, collection, changes) => {
        this.cache.assertCollectionExists(index, collection);
        this.client.updateCollection(index, collection, changes);
      });
  }

  registerIndexEvents () {
    /**
     * Create a new index within this adapter scope
     * @param  {string} index
     * @returns {Promise}
     * @throws
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:index:create`,
      index => this.createIndex(index));

    /**
     * Delete an index
     * @param {string} index
     * @return {Promise}
     * @throws If the index does not exist
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:index:delete`,
      index => this.deleteIndex(index));

    /**
     * Check an index existence
     * @param {string} index
     * @return {Promise.<boolean>}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:index:exist`,
      index => this.cache.hasIndex(index));

    /**
     * Return a list of all indexes within this adapter's scope
     * @returns {string[]}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:index:list`,
      () => this.cache.listIndexes());

    /**
     * Delete multiple indexes
     * @param {string[]} indexes
     * @return {Promise}
     * @throws If at least one index does not exist
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:index:mDelete`,
      indexes => this.deleteIndexes(indexes));
  }

  registerDocumentEvents () {
    /**
     * Execute actions on documents in bulk
     *
     * @param {string} index
     * @param {string} collection
     * @param {Object[]} bulk data, in ES format
     * @param {Object} [opts] -- see Elasticsearch "import" options
     * @returns {Promise.<{ items, errors }>
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:bulk`,
      (index, collection, bulk, opts) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.import(index, collection, bulk, opts);
      });

    /**
     * Count how many documents match the provided query
     *
     * @param {string} index
     * @param {string} collection
     * @param {Object} query -- search query
     * @return {Promise.<Number>}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:count`,
      (index, collection, query) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.count(index, collection, query);
      });

    /**
     * Create a document
     *
     * @param {string} index
     * @param {string} collection
     * @param {Object} content
     * @param {Object} [opts] -- see Elasticsearch "create" options
     * @returns {Promise.<{ _id, _version, _source }>}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:create`,
      (index, collection, content, opts) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.create(index, collection, content, opts);
      });

    /**
     * Create or replace a document
     *
     * @param {string} index
     * @param {string} collection
     * @param {string} id -- document unique identifier
     * @param {Object} content
     * @param {Object} [opts] -- see Elasticsearch "createOrReplace" options
     * @returns {Promise.<{ _id, _version, _source, created }>}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:createOrReplace`,
      (index, collection, id, content, opts) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.createOrReplace(index, collection, id, content, opts);
      });

    /**
     * Delete a document
     *
     * @param {string} index
     * @param {string} collection
     * @param {string} id
     * @param {Object} [opts] -- see Elasticsearch "delete" options
     * @returns {Promise}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:delete`,
      (index, collection, id, opts) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.delete(index, collection, id, opts);
      });

    /**
     * Delete all documents matching the provided search query
     *
     * @param {string} index
     * @param {string} collection
     * @param {Object} query
     * @param {Object} [opts] -- see Elasticsearch "deleteByQuery" options
     * @returns {Promise.<{ documents, total, deleted, failures: [ _shardId, reason ] }>}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:deleteByQuery`,
      (index, collection, query, opts) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.deleteByQuery(index, collection, query, opts);
      });

    /**
     * Check if a document exists
     *
     * @param {string} index
     * @param {string} collection
     * @param {string} id -- document unique identifier
     * @returns {Promise.<boolean>}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:exist`,
      (index, collection, id) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.exists(index, collection, id);
      });

    /**
     * Get a document using its unique id
     *
     * @param {string} index
     * @param {string} collection
     * @param {string} id -- document unique identifier
     * @returns {Promise.<{ _id, _version, _source }>}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:get`,
      (index, collection, id) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.get(index, collection, id);
      });

    /**
     * Import documents as fixtures
     * @param  {Objects} fixtures
     * @return {Promise}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:import`,
      fixtures => this.loadFixtures(fixtures));

    /**
     * Create multiple documents
     *
     * @param {string} index
     * @param {string} collection
     * @param {Object[]} documents
     * @param {Object} [opts] -- see Elasticsearch "mCreate" options
     * @returns {Promise.<{ items, errors }>
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:mCreate`,
      (index, collection, documents, opts) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.mCreate(index, collection, documents, opts);
      });

    /**
     * Create or replace multiple documents
     *
     * @param {string} index
     * @param {string} collection
     * @param {Object[]} documents
     * @param {Object} [opts] -- see Elasticsearch "mCreateOrReplace" options
     * @returns {Promise.<{ items, errors }>
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:mCreateOrReplace`,
      (index, collection, documents, opts) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.mCreateOrReplace(index, collection, documents, opts);
      });

    /**
     * Delete multiple documents
     *
     * @param {string} index
     * @param {string} collection
     * @param {string[]} ids
     * @param {Object} [opts] -- see Elasticsearch "mDelete" options
     * @returns {Promise.<{ documents, errors }>
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:mDelete`,
      (index, collection, ids, opts) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.mDelete(index, collection, ids, opts);
      });

    /**
     * Replace multiple documents
     *
     * @param {string} index
     * @param {string} collection
     * @param {Object[]} documents
     * @param {Object} [opts] -- see Elasticsearch "mReplace" options
     * @returns {Promise.<{ items, errors }>
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:mReplace`,
      (index, collection, documents, opts) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.mReplace(index, collection, documents, opts);
      });

    /**
     * Update multiple documents
     *
     * @param {string} index
     * @param {string} collection
     * @param {Object[]} documents
     * @param {Object} [opts] -- see Elasticsearch "mUpdate" options
     * @returns {Promise.<{ items, errors }>
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:mUpdate`,
      (index, collection, documents, opts) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.mUpdate(index, collection, documents, opts);
      });

    /**
     * Apply the provided callback to all documents matching a search query
     *
     * @param {string} index
     * @param {string} collection
     * @param {Object} query -- search query (ES format)
     * @param {Function} callback -- callback applied to matched documents
     * @param {Object} [opts] -- see Elasticsearch "mExecute" options
     * @returns {Promise.<any[]>} Array of results returned by the callback
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:mExecute`,
      (index, collection, query, callback, opts) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.mExecute(index, collection, query, callback, opts);
      });

    /**
     * Get multiple documents using their ids
     *
     * @param {string} index
     * @param {string} collection
     * @param {string[]} ids
     * @returns {Promise.<{ items: [ _id, _source, _version ], errors }>}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:mGet`,
      (index, collection, ids) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.mGet(index, collection, ids);
      });

    /**
     * Replace the content of a document
     *
     * @param {string} index
     * @param {string} collection
     * @param {string} id
     * @param {Object} content -- new document content
     * @param {Object} [opts] -- see Elasticsearch "replace" options
     * @returns {Promise.<{ _id, _version, _source }>}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:replace`,
      (index, collection, id, content, opts) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.replace(index, collection, id, content, opts);
      });

    /**
     * Fetch the next page of results of a search query
     *
     * @param {string} scrollId
     * @param {Object} [opts] -- see Elasticsearch "scroll" options
     * @returns {Promise.<{ scrollId, hits, aggregations, total }>}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:scroll`,
      (scrollId, opts) => this.client.scroll(scrollId, opts));

    /**
     * Search for documents
     *
     * @param {string} index
     * @param {string} collection
     * @param {Object} query -- search query, in ES format
     * @param {Object} [opts] -- see Elasticsearch "search" options
     * @returns {Promise.<{ scrollId, hits, aggregations, total }>}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:search`,
      (index, collection, query, opts) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.search(index, collection, query, opts);
      });

    /**
     * Update a document
     *
     * @param {string} index
     * @param {string} collection
     * @param {string} id -- document unique identifier
     * @param {Object} content -- partial content to update
     * @param {Object} [opts] -- see Elasticsearch "update" options
     * @returns {Promise.<{ _id, _version }>}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:update`,
      (index, collection, id, content, opts) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.update(index, collection, id, content, opts);
      });

    /**
     * Update all documents matching the search query, by applying the same
     * changes to all of them.
     *
     * @param {string} index
     * @param {string} collection
     * @param {Object} query -- search query, in ES format
     * @param {Object} changes -- partial changes to apply to matched documents
     * @param {Object} [opts] -- see Elasticsearch "updateByQuery" options
     * @returns {Promise.<{ successes: [_id, _source, _status], errors: [ document, status, reason ] }>}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:document:updateByQuery`,
      (index, collection, query, changes, opts) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.updateByQuery(index, collection, query, changes, opts);
      });
  }

  registerMappingEvents () {
    /**
     * Return a collection's mapping
     *
     * @param {string} index
     * @param {string} collection
     * @param {Object} [opts] -- see Elasticsearch "getMapping" options
     *
     * @returns {Promise.<{ dynamic, _meta, properties }>}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:mappings:get`,
      (index, collection, opts) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.getMapping(index, collection, opts);
      });

    /**
     * Import mappings as fixtures. Create non-existing indexes and collections
     * in the process.
     *
     * @param  {Object} fixtures
     * @return {Promise}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:mappings:import`,
      fixtures => this.loadMappings(fixtures));

    /**
     * Update a collection mappings
     *
     * @param {string} index
     * @param {string} collection
     * @param {Object} mappings
     * @returns {Promise.<{ dynamic, _meta, properties }>}
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:mappings:update`,
      (index, collection, mappings) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.updateMapping(index, collection, mappings);
      });
  }

  /**
   * Cache update operations. These events trigger neither any actual change
   * in the storage layer, nor kuzzle events.
   */
  registerCacheEvents () {
    /**
     * Add a new index to the cache
     * @param  {string} index
     */
    this.kuzzle.onAsk(
      `core:storage:${this.scope}:cache:add`,
      (index, collection) => {
        if (collection) {
          this.cache.addCollection(index, collection, { notify: false });
        }
        else {
          this.cache.addIndex(index, { notify: false });
        }
      });

    this.kuzzle.onAsk(
      `core:storage:${this.scope}:cache:remove`,
      (index, collection) => {
        if (collection) {
          this.cache.removeCollection(index, collection, { notify: false });
        }
        else {
          this.cache.removeIndex(index, { notify: false });
        }
      });
  }

  /**
   * Load database fixtures into Kuzzle
   *
   * @param {String} fixturesId
   * @returns {Promise}
   */
  async loadFixtures (fixtures = {}) {
    if (!isPlainObject(fixtures)) {
      throw kerror.get('api', 'assert', 'invalid_argument', fixtures, 'object');
    }

    for (const index of Object.keys(fixtures)) {
      if (!isPlainObject(fixtures[index])) {
        throw kerror.get('api', 'assert', 'invalid_argument', fixtures[index], 'object');
      }

      for (const [collection, payload] of Object.entries(fixtures[index])) {
        this.cache.assertCollectionExists(index, collection);

        const { errors } = await this.client.import(
          index,
          collection,
          payload,
          { refresh: 'wait_for' });

        if (errors.length > 0) {
          throw servicesError.get('import_failed', errors);
        }
      }
    }
  }

  /**
   * Load database mappings into Kuzzle
   *
   * @param {String} mappings
   * @returns {Promise}
   */
  async loadMappings (fixtures = {}) {
    if (!isPlainObject(fixtures)) {
      throw kerror.get('api', 'assert', 'invalid_argument', fixtures, 'object');
    }

    const mutex = new Mutex(this.kuzzle, 'loadMappings', {
      timeout: -1,
      ttl: 60000,
    });

    await mutex.lock();

    try {
      for (const index of Object.keys(fixtures)) {
        if (!isPlainObject(fixtures[index])) {
          throw kerror.get('api', 'assert', 'invalid_argument', fixtures[index], 'object');
        }

        for (const [collection, mappings] of Object.entries(fixtures[index])) {
          try {
            await this.createIndex(index);
          }
          catch (error) {
            // @cluster: ignore if the index already exists to prevent race
            // conditions
            if (error.id !== 'services.storage.index_already_exists') {
              throw error;
            }
          }

          await this.createCollection(index, collection, { mappings });
        }
      }
    }
    finally {
      mutex.unlock();
    }
  }
}

module.exports = ClientAdapter;
