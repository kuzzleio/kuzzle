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

const Bluebird = require('bluebird');

/**
 * Wrapper around a storage engine.
 * Once instantiated, this class can only access the index passed in the
 * constructor
 */
class RestrictedStorage {
  /**
   *
   * @param {Kuzzle} kuzzle
   * @param {String} index
   * @param {StorageEngine} storageEngine
   */
  constructor (kuzzle, index, storageEngine) {
    this.kuzzle = kuzzle,
    this.index = index;
    this.storageEngine = storageEngine;

    this.indexBootstrap = null;
  }

  /**
   * Bootstrap the index if a boostraper has been provided
   *
   * @return {Promise}
   */
  bootstrap () {
    if (! this.indexBootstrap) {
      return Bluebird.resolve();
    }

    return this.indexBootstrap.startOrWait();
  }

  /**
   * Gets the document with given ID
   *
   * @param {String} collection - Collection name
   * @param {String} id - Document ID
   *
   * @returns {Promise.<Object>} { _id, _version, _source }
   */
  get (collection, id) {
    return this.storageEngine.get(this.index, collection, id);
  }

  /**
   * Returns the list of documents matching the ids given in the body param
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {Array.<String>} ids - Document IDs
   *
   * @returns {Promise.<Object>} { hits, total }
   */
  mGet (collection, ids) {
    return this.storageEngine.mGet(this.index, collection, ids);
  }

  /**
   * Searches documents
   *
   * @param {String} collection - Collection name
   * @param {Object} searchBody - Search request body (query, sort, etc.)
   * @param {Object} options - from (null), size (null), scroll (null)
   *
   * @returns {Promise.<Object>} { scrollId, hits, aggregations, total }
   */
  search (collection, searchBody, options = {}) {
    return this.storageEngine.search(
      this.index,
      collection,
      searchBody,
      options);
  }

  /**
   * Scroll results from previous search
   *
   * @param {String} collection - Collection name
   * @param {String} scrollId - Scroll identifier
   * @param {Object} options - scroll (default scrollTTL)
   *
   * @returns {Promise.<Object>} { scrollId, hits, total }
   */
  scroll (collection, scrollId, scrollTTL) {
    return this.storageEngine.scroll(
      this.index,
      collection,
      scrollId,
      { scroll: scrollTTL });
  }

  /**
   * Creates a new document
   *
   * @param {String} collection - Collection name
   * @param {Object} content - Document content
   * @param {String} collection - Document ID
   * @param {Object} options - refresh (false)
   *
   * @returns {Promise.<Object>} { _id, _version, _source }
   */
  create (collection, id, content, options = {}) {
    const opts = {
      id,
      refresh: options.refresh
    };

    return this.storageEngine.create(this.index, collection, content, opts);
  }

  /**
   * Creates a new document, or replace it if it already exist
   *
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Object} content - Document content
   * @param {Object} options - refresh (false)
   *
   * @returns {Promise.<Object>} { _id, _version, _source, created }
   */
  createOrReplace (collection, id, content, options = {}) {
    const opts = {
      refresh: options.refresh
    };

    return this.storageEngine.createOrReplace(
      this.index,
      collection,
      id,
      content,
      opts);
  }

  /**
   * Replaces a document
   *
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Object} content - Document content
   * @param {Object} options - refresh (false)
   *
   * @returns {Promise.<Object>} { _id, _version, _source }
   */
  replace (collection, id, content, options = {}) {
    const opts = {
      refresh: options.refresh
    };

    return this.storageEngine.replace(
      this.index,
      collection,
      id,
      content,
      opts);
  }

  /**
   * Partialy updates a document
   *
   * @param {String} index - Index name
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Object} content - Updated content
   * @param {Object} options - refresh (false)
   *
   * @returns {Promise.<Object>} { _id, _version }
   */
  update (collection, id, content, options = {}) {
    const opts = {
      refresh: options.refresh
    };

    return this.storageEngine.update(this.index, collection, id, content, opts);
  }

  /**
   * Deletes a document
   *
   * @param {String} collection - Collection name
   * @param {String} id - Document id
   * @param {Object} options - refresh (false)
   *
   * @returns {Promise.<Object>} { _id }
   */
  delete (collection, id, options = {}) {
    const opts = {
      refresh: options.refresh
    };

    return this.storageEngine.delete(this.index, collection, id, opts);
  }

  /**
   * Returns true if the document exists
   *
   * @param {String} collection - Collection name
   * @param {String} id - Document ID
   *
   * @returns {Promise.<boolean>}
   */
  exists (collection, id) {
    return this.storageEngine.exists(this.index, collection, id);
  }

  /**
   * Creates an empty collection. Mapping will be applied if supplied.
   *
   * @param {String} collection - Collection name
   * @param {Object} mappings - Collection mappings in ES format
   *
   * @returns {Promise}
   */
  createCollection (collection, mappings) {
    return this.storageEngine.createCollection(this.index, collection, mappings)
      .then(() => {
        this.kuzzle.indexCache.add(this.index, collection);
      });
  }
}

module.exports = RestrictedStorage;
