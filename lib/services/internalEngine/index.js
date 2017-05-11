/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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
  es = require('elasticsearch'),
  {
    NotFoundError,
    KuzzleError,
    InternalError: KuzzleInternalError,
    ServiceUnavailableError
  } = require('kuzzle-common-objects').errors;


/**
 * @param {Kuzzle} kuzzle instance
 * @param {string} index
 * @constructor
 */
class InternalEngine {
  constructor (kuzzle, index = '%kuzzle') {
    this.kuzzle = kuzzle;
    this.client = null;
    this.index = index;
    this.bootstrap = null;
    this.config = this.kuzzle.config.services.db;
  }

  /**
   * Initialize the elasticsearch client
   *
   * @returns {object} client
   */
  init (bootstrap) {
    this.bootstrap = bootstrap;

    if (!this.client) {
      this.client = new es.Client({
        hosts: this.config.hosts || this.config.host + ':' + this.config.port,
        apiVersion: this.config.apiVersion
      });
    }

    return this.kuzzle.indexCache.initInternal(this)
      .then(() => this);
  }

  /**
   * Search documents from elasticsearch with a query
   * @param {string} type - data collection
   * @param {object} [query] - optional query
   * @param {object} [options] - optional search arguments (from, size, scroll)
   * @returns {Promise} resolve documents matching the query
   */
  search (type, query, options = {}) {
    const
      request = {
        index: this.index,
        type
      };

    _.intersection(Object.keys(options), ['from', 'size', 'scroll']).forEach(opt => {
      request[opt] = options[opt];
    });

    if (query) {
      request.body = query.query ? {query: query.query} : {query};
    }

    return this.client.search(request)
      .then(raw => {
        const result = raw.hits || {hits: [], total: 0};

        // register the scroll id (if any)
        if (raw._scroll_id) {
          const
            ttl = ms(options.scroll) || ms(this.config.defaults.scrollTTL),
            key = type + this.kuzzle.constructor.hash(raw._scroll_id);

          result.scrollId = raw._scroll_id;

          return this.kuzzle.services.list.internalCache.psetex(key, ttl, 0)
            .then(() => result);
        }

        return result;
      })
      .catch(error => handleError(error));
  }

  /**
   * Returns the next page of a scroll search
   *
   * @param {string} type
   * @param {string} scrollId
   * @param {string} [ttl]
   * @return {Promise}
   */
  scroll (type, scrollId, ttl = this.config.defaults.scrollTTL) {
    const
      request = {
        scrollId,
        scroll: ttl
      },
      cacheKey = type + this.kuzzle.constructor.hash(scrollId);

    return this.kuzzle.services.list.internalCache.exists(cacheKey)
      .then(exists => {
        if (exists === 0) {
          throw new NotFoundError('Non-existing or expired scroll identifier');
        }

        // ms(ttl) may return undefined if in microseconds or in nanoseconds
        const msttl = ms(ttl) || ms(this.config.defaults.scrollTTL);

        return this.kuzzle.services.list.internalCache.pexpire(cacheKey, msttl);
      })
      .then(() => this.client.scroll(request))
      .then(raw => {
        const result = raw.hits || {hits: [], total: 0};

        result.scrollId = raw._scroll_id;

        return result;
      })
      .catch(err => handleError(err));
  }

  /**
   *
   * @param type
   * @param id
   */
  exists (type, id) {
    return this.client.exists({
      index: this.index,
      type,
      id
    })
      .catch(error => handleError(error));
  }

  /**
   * Get the document with given ID
   *
   * @param {string} type - data collection
   * @param {string} id - id of the document to retrieve
   * @returns {Promise} resolve the document
   */
  get (type, id) {
    const request = {
      index: this.index,
      type,
      id
    };

    return this.client.get(request)
      .catch(error => handleError(error));
  }

  /**
   * Return the list of documents matching the ids given in the body param
   * NB: Due to internal Kuzzle mechanism, can only be called on a single index/collection,
   * using the body { ids: [.. } syntax.
   *
   * @param {string} type - data collection
   * @param {array} ids - list of document IDs to get
   * @returns {Promise}
   */
  mget (type, ids) {
    const request = {
      type,
      index: this.index,
      body: {
        ids
      }
    };

    return this.client.mget(request)
      .then(result => {
        // harmonize response format based upon the search one
        if (result.docs) {
          result.hits = result.docs;
          delete result.docs;
        }

        return result;
      })
      .catch(error => handleError(error));
  }

  /**
   * Send to elasticsearch the new document
   *
   * @param {string} type - data collection
   * @param {string} id - document ID
   * @param {object} content
   * @returns {Promise}
   */
  create (type, id, content) {
    const request = {
      type,
      id,
      index: this.index,
      body: content
    };

    // extends the response with the source from request
    // When we write in ES, the response from it doesn't contain the initial document content
    return this.client.create(request)
      .then(result => _.extend(result, {_source: content}))
      .catch(error => handleError(error));
  }

  /**
   * Create a new document to ElasticSearch, or replace it if it already exist
   *
   * @param {string} type - data collection
   * @param {string} id - document ID
   * @param {object} content
   * @returns {Promise}
   */
  createOrReplace (type, id, content) {
    const request = {
      type,
      id,
      index: this.index,
      body: content
    };

    // extends the response with the source from request
    // When we write in ES, the response from it doesn't contain the initial document content
    return this.client.index(request)
      .then(result => _.extend(result, {_source: content}))
      .catch(error => handleError(error));
  }

  /**
   * Performs a partial update to a document
   *
   * @param {string} type - data collection
   * @param {string} id of the document to update
   * @param {object} updateContent
   * @returns {Promise} resolve an object that contains _id
   */
  update (type, id, updateContent) {
    const request = {
      type,
      id,
      index: this.index,
      body: {
        doc: updateContent
      }
    };

    return this.client.update(request)
      .catch(error => handleError(error));
  }

  /**
   * Replace a document with new content
   *
   * @param {string} type - data collection
   * @param {string} id - document ID
   * @param {object} content
   * @returns {Promise}
   */
  replace (type, id, content) {
    // extends the response with the source from request
    // When we write in ES, the response from it doesn't contain the initial document content
    return this.exists(type, id)
      .then(exists => {
        const request = {
          type,
          id,
          index: this.index,
          body: content
        };

        if (exists) {
          return this.client.index(request);
        }

        return Bluebird.reject(new NotFoundError(`Document with id "${id}" not found.`));
      })
      .then(result => _.extend(result, {_source: content}))
      .catch(error => handleError(error));
  }

  /**
   * Send to elasticsearch the document id to delete
   *
   * @param {string} type - data collection
   * @param {string} id - id of the document to delete
   * @param {object} [options]
   * @returns {Promise} resolve an object that contains _id
   */
  delete (type, id, options = {}) {
    const request = {
      index: this.index,
      type,
      id
    };

    if (options.refresh === 'wait_for') {
      request.refresh = 'wait_for';
    }

    return this.client.delete(request)
      .catch(error => handleError(error));
  }

  /**
   * Get the list of existing indexes in elasticsearch
   *
   * @returns {Promise}
   */
  listIndexes () {
    return this.client.indices.getMapping()
      .then(response => Object.keys(response))
      .catch(error => handleError(error));
  }

  /**
   * Get the list of existing collections in elasticsearch
   *
   * @returns {Promise}
   */
  listCollections (index) {
    return this.client.indices.getMapping({index})
      .then(result => {
        if (result[index] && result[index].mappings) {
          return Object.keys(result[index].mappings);
        }

        return [];
      })
      .catch(error => handleError(error));
  }

  /**
   * Retrieve mapping definiton of index or index/collection
   *
   * @returns {Promise}
   */
  getMapping (data) {
    return this.client.indices.getMapping(data)
      .catch(error => handleError(error));
  }

  /**
   * Create the internal index
   *
   * @returns {Promise}
   */
  createInternalIndex () {
    return this.client.indices.exists({index: this.index})
      .then(exists => {
        if (!exists) {
          return this.client.indices.create({
            index: this.index
          });
        }
      })
      .catch(error => handleError(error));
  }

  /**
   * Deletes the internal index
   *
   * @returns {*}
   */
  deleteIndex () {
    return this.client.indices.delete({
      index: this.index
    })
      .catch(error => handleError(error));
  }

  /**
   * Add a mapping definition to a specific type
   *
   * @param {string} type - data collection
   * @param {object} mapping
   * @return {Promise}
   */
  updateMapping (type, mapping) {
    const request = {
      type,
      index: this.index,
      body: mapping
    };

    return this.client.indices.putMapping(request)
      .catch(error => handleError(error));
  }

  /**
   * Refreshes the internal index
   * @returns {Promise}
   */
  refresh () {
    return this.client.indices.refresh({
      index: this.index
    })
      .catch(error => handleError(error));
  }
}

function handleError(error) {
  if (error instanceof es.errors.NoConnections) {
    return Bluebird.reject(new ServiceUnavailableError('es service is not connected'));
  }

  if (error instanceof KuzzleError) {
    return Bluebird.reject(error);
  }

  if (error.status === 404) {
    return Bluebird.reject(new NotFoundError(`Not found: ${error.body._type}/${error.body._id}`));
  }

  return Bluebird.reject(new KuzzleInternalError(error));
}

module.exports = InternalEngine;
