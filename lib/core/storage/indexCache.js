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

const kerror = require('../../kerror').wrap('services', 'storage');

class IndexCache {
  /**
   * @param  {storeScopeEnum} scope
   */
  constructor (scope) {
    this.scope = scope;

    /**
     * Index map: each entry holds a set of collection names
     * @type {Map.<String, Set>}
     */
    this.indexes = new Map();
  }

  /**
   * Cache a new index
   * @param {string} index
   * @return {boolean} true if an index was added, false if there is no
   *                   modification
   */
  addIndex (index) {
    if (this.indexes.has(index)) {
      return false;
    }

    this.indexes.set(index, new Set());

    return true;
  }

  /**
   * Cache a new collection
   * @param {string} index
   * @param {string} collection
   */
  addCollection (index, collection) {
    this.addIndex(index);
    const collections = this.indexes.get(index);

    collections.add(collection);
  }

  /**
   * Check an index existence
   * @param {string} index
   * @returns {boolean}
   */
  hasIndex (index) {
    return this.indexes.has(index);
  }

  /**
   * Check a collection existence
   * @param {string} index
   * @param {string} collection
   * @returns {boolean}
   */
  hasCollection (index, collection) {
    const collections = this.indexes.get(index);

    if (!collections) {
      return false;
    }

    return collections.has(collection);
  }

  /**
   * Return the list of cached indexes
   * @returns {string[]}
   */
  listIndexes () {
    return Array.from(this.indexes.keys());
  }

  /**
   * Return the list of an index' collections
   * @param {string} index
   * @returns {string[]}
   * @throws If the provided index does not exist
   */
  listCollections (index) {
    this.assertIndexExists(index);

    return Array.from(this.indexes.get(index));
  }

  /**
   * Remove an index from the cache
   * @param  {string} index
   */
  removeIndex (index) {
    this.indexes.delete(index);
  }

  /**
   * Remove a collection from the cache
   * @param {string} index
   * @param {string} collection
   */
  removeCollection (index, collection) {
    const collections = this.indexes.get(index);

    if (collections) {
      collections.delete(collection);
    }
  }

  /**
   * Assert that the provided index exists
   * @param  {string} index
   * @throws If the index does not exist
   */
  assertIndexExists (index) {
    if (!this.indexes.has(index)) {
      throw kerror.get('unknown_index', index);
    }
  }

  /**
   * Assert that the provided index and collection exist
   * @param {string} index
   * @param {string} collection
   */
  assertCollectionExists (index, collection) {
    this.assertIndexExists(index);

    if (!this.indexes.get(index).has(collection)) {
      throw kerror.get('unknown_collection', index, collection);
    }
  }
}

module.exports = IndexCache;
