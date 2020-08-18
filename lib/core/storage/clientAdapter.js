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
   * @param {storageScopeEnum} scope
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
     * @returns {Promise.<null>}
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
    this.kuzzle.onAsk(
      `core:store:${this.scope}:document:import`,
      fixtures => this.loadFixtures(fixtures));
  }

  registerMappingEvents () {
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
