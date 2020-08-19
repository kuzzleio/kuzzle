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
const IndexCache = require('./indexCache');
const { assertIsObject } = require('../../util/requestAssertions');
const kerror = require('../../kerror').wrap('services', 'storage');

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

    // Global store events registration

    /**
     * Return information about the instantiated ES service
     * @returns {Promise.<Object>}
     */
    this.kuzzle.onAsk(
      `core:store:${this.scope}:info:get`,
      () => this.client.info());
  }

  async createIndex (index) {
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

    await this.client.deleteIndexes(indexes);

    for (const index of indexes) {
      this.indexCache.removeIndex(index);
    }
  }

  async deleteCollection (index, collection) {
    this.cache.assertCollectionExists(index, collection);

    await this.client.deleteCollection(index, collection);

    this.cache.removeCollection(index, collection);
  }

  async hasIndex (index, { fromCache = true } = {}) {
    if (fromCache) {
      return this.cache.hasIndex(index);
    }

    return this.client.hasIndex(index);
  }

  async hasCollection (index, collection, { fromCache = true } = {}) {
    if (fromCache) {
      return this.cache.hasCollection(index, collection);
    }

    return this.client.hasCollection(index, collection);
  }

  async listIndexes ({ fromCache = true } = {}) {
    if (fromCache) {
      return this.cache.listIndexes();
    }

    return this.client.listIndexes();
  }

  async listCollections (index, { fromCache = true } = {}) {
    if (fromCache) {
      return this.cache.listCollections(index);
    }

    return this.client.listCollections(index);
  }

  async refreshCollection (index, collection) {
    this.cache.assertCollectionExists(index, collection);

    return this.client.refreshCollection(index, collection);
  }

  /**
   * Populates the index cache with existing index/collection and aliases.
   * Also checks for duplicated index names.
   *
   * @returns {Promise}
   */
  async populateCache () {
    const indexes = this.listIndexes({ fromCache: false });

    await Bluebird.map(indexes, async index => {
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
      `core:store:${this.scope}:collection:create`,
      (index, collection, opts) => this.createCollection(index, collection, opts));

    /**
     * Delete a collection
     * @param {string} index
     * @param {string} collection
     * @return {Promise}
     * @throws If the index or the collection does not exist
     */
    this.kuzzle.onAsk(
      `core:store:${this.scope}:collection:delete`,
      (index, collection) => this.deleteCollection(index, collection));

    /**
     * Check a collection existence
     * @param {string} index
     * @param {string} collection
     * @param {Promise.<{fromCache: boolean}>} [opts]
     */
    this.kuzzle.onAsk(
      `core:store:${this.scope}:collection:exist`,
      (index, collection, opts) => this.hasCollection(index, collection, opts));

    /**
     * Return a list of an index' collections within this adapter's scope
     * @param {string} index
     * @param {{fromCache: boolean}} [opts]
     * @returns {Promise.<string[]>}
     */
    this.kuzzle.onAsk(
      `core:store:${this.scope}:collection:list`,
      (index, opts) => this.listCollections(index, opts));

    /**
     * Refresh a collection
     * @param {string} index
     * @param {string} collection
     * @returns {Promise}
     */
    this.kuzzle.onAsk(
      `core:store:${this.scope}:collection:refresh`,
      (index, collection) => this.refreshCollection(index, collection));
  }

  registerIndexEvents () {
    /**
     * Create a new index within this adapter scope
     * @param  {string} index
     * @returns {Promise}
     * @throws
     */
    this.kuzzle.onAsk(
      `core:store:${this.scope}:index:create`,
      index => this.createIndex(index));

    /**
     * Delete an index
     * @param {string} index
     * @return {Promise}
     * @throws If the index does not exist
     */
    this.kuzzle.onAsk(
      `core:store:${this.scope}:index:delete`,
      index => this.deleteIndex(index));

    /**
     * Check an index existence
     * @param {string} index
     * @param {{fromCache: boolean}} [opts]
     * @return {Promise.<boolean>}
     */
    this.kuzzle.onAsk(
      `core:store:${this.scope}:index:exist`,
      index => this.hasIndex(index));

    /**
     * Return a list of all indexes within this adapter's scope
     * @param {{fromCache: boolean}} [opts]
     * @returns {string[]}
     */
    this.kuzzle.onAsk(
      `core:store:${this.scope}:index:list`,
      opts => this.listIndexes(opts));

    /**
     * Delete multiple indexes
     * @param {string[]} indexes
     * @return {Promise}
     * @throws If at least one index does not exist
     */
    this.kuzzle.onAsk(
      `core:store:${this.scope}:index:mDelete`,
      indexes => this.deleteIndexes(indexes));
  }

  registerDocumentEvents () {
    /**
     * Count how many documents match the provided query
     *
     * @param {string} index
     * @param {string} collection
     * @param {Object} query -- search query
     * @return {Promise.<Number>}
     */
    this.kuzzle.onAsk(
      `core:store:${this.scope}:document:count`,
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
      `core:store:${this.scope}:document:create`,
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
      `core:store:${this.scope}:document:createOrReplace`,
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
      `core:store:${this.scope}:document:delete`,
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
      `core:store:${this.scope}:document:deleteByQuery`,
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
      `core:store:${this.scope}:document:exist`,
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
      `core:store:${this.scope}:document:get`,
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
      `core:store:${this.scope}:document:import`,
      fixtures => this.loadFixtures(fixtures));

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
      `core:store:${this.scope}:document:mExecute`,
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
      `core:store:${this.scope}:document:mGet`,
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
      `core:store:${this.scope}:document:replace`,
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
      `core:store:${this.scope}:document:scroll`,
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
      `core:store:${this.scope}:document:search`,
      (index, collection, query, opts) => {
        this.cache.assertCollectionExists(index, collection);
        return this.client.search(index, collection, query, opts);
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
      `core:store:${this.scope}:mappings:get`,
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
      `core:store:${this.scope}:mappings:import`,
      fixtures => this.loadMappings(fixtures));
  }

  /**
   * Load database fixtures into Kuzzle
   *
   * @param {String} fixturesId
   * @returns {Promise}
   */
  async loadFixtures (fixtures = {}) {
    assertIsObject(fixtures);

    for (const index of Object.keys(fixtures)) {
      assertIsObject(fixtures[index]);

      for (const [collection, payload] of Object.entries(fixtures[index])) {
        this.cache.assertCollectionExists(index, collection);

        const { errors } = await this.client.import(
          index,
          collection,
          payload,
          { refresh: 'wait_for' });

        if (errors.length > 0) {
          throw kerror.get('import_failed', errors);
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
    assertIsObject(fixtures);

    for (const index of Object.keys(fixtures)) {
      assertIsObject(fixtures[index]);

      for (const [collection, mappings] of Object.entries(fixtures[index])) {
        try {
          await this.createIndex(index);
        }
        catch (error) {
          // @cluster: ignore if the index already exists to prevent race
          // condition
          if (error.id !== 'services.storage.index_already_exists') {
            throw error;
          }
        }

        await this.createCollection(index, collection, { mappings });
      }
    }
  }
}

module.exports = ClientAdapter;
