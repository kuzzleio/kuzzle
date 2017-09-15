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

'use strict';

const
  _ = require('lodash'),
  Bluebird = require('bluebird'),
  ESWrapper = require('../util/esWrapper'),
  Service = require('./service'),
  Request = require('kuzzle-common-objects').Request,
  es = require('elasticsearch'),
  ms = require('ms'),
  semver = require('semver'),
  {
    BadRequestError,
    InternalError: KuzzleInternalError,
    NotFoundError,
    PreconditionError
  } = require('kuzzle-common-objects').errors;

const scrollCachePrefix = '_docscroll_';

/**
 * @property {Kuzzle} kuzzle
 * @property {object} settings
 * @property {object} client
 * @param {Kuzzle} kuzzle kuzzle instance
 * @param {object} options used to start the service
 * @param {object} config used to start the service
 * @constructor
 */
class ElasticSearch extends Service {
  constructor(kuzzle, options, config) {
    super();
    this.kuzzle = kuzzle;
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
  init() {
    if (this.client) {
      return Bluebird.resolve(this);
    }

    this.client = buildClient(this.config);
    this.esWrapper = new ESWrapper(this.client);

    return Bluebird.resolve(this.client.info()
      .then(response => {
        this.esVersion = response.version;

        if (this.esVersion && !semver.satisfies(this.esVersion.number, '5.x')) {
          throw new KuzzleInternalError(`Your elasticsearch version is ${this.esVersion.number}; Only elasticsearch version 5.0.0 and above are supported.`);
        }

        return this;
      }));
  }

  /**
   * Return some basic information about this service
   *
   * @returns {Promise} service informations
   */
  getInfos() {
    const response = {
      type: 'elasticsearch',
      api: this.config.apiVersion
    };

    return this.client.info()
      .then(res => {
        /** @type {{version: {number: Number, lucene_version: String}}} res */
        response.version = res.version.number;
        response.lucene = res.version.lucene_version;

        return this.client.cluster.health();
      })
      .then(res => {
        /** @type {{status: String, number_of_nodes: Number}} res */
        response.status = res.status;
        response.nodes = res.number_of_nodes;
        return this.client.cluster.stats({human: true});
      })
      .then(res => {
        response.spaceUsed = res.indices.store.size;
        response.nodes = res.nodes;
        return response;
      })
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Scroll results from previous elasticsearch query
   * @param {Request} request
   * @returns {Promise} resolve documents matching the scroll id
   */
  scroll(request) {
    const esRequest = initESRequest(request, ['scroll', 'scrollId']);

    if (!esRequest.scroll) {
      esRequest.scroll = this.config.defaults.scrollTTL;
    }

    const cacheKey = scrollCachePrefix + this.kuzzle.constructor.hash(esRequest.scrollId);

    return this.kuzzle.services.list.internalCache.exists(cacheKey)
      .then(exists => {
        if (exists === 0) {
          throw new NotFoundError('Non-existing or expired scroll identifier');
        }

        // ms(scroll) may return undefined if in microseconds or in nanoseconds
        const ttl = ms(esRequest.scroll) || ms(this.config.defaults.scrollTTL);

        return this.kuzzle.services.list.internalCache.pexpire(cacheKey, ttl);
      })
      .then(() => this.client.scroll(esRequest))
      .then(result => flattenSearchResults(result))
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Search documents from elasticsearch with a query
   * @param {Request} request
   * @returns {Promise} resolve documents matching the filter
   */
  search(request) {
    const esRequest = initESRequest(request, ['from', 'size', 'scroll']);

    esRequest.body = request.input.body;

    if (!request.input.args.includeTrash) {
      addActiveFilter(esRequest);
    }

    return this.client.search(esRequest)
      .then(result => {
        const flattened = flattenSearchResults(result);

        if (flattened._scroll_id !== undefined) {
          const
            // ms(scroll) may return undefined if in microseconds or in nanoseconds
            ttl = ms(esRequest.scroll) || ms(this.config.defaults.scrollTTL),
            key = scrollCachePrefix + this.kuzzle.constructor.hash(flattened._scroll_id);

          return this.kuzzle.services.list.internalCache.psetex(key, ttl, 0)
            .then(() => flattened);
        }

        return flattened;
      })
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Get the document with given ID
   * @param {Request} request
   * @returns {Promise} resolve the document
   */
  get(request) {
    const esRequest = initESRequest(request);

    esRequest.id = request.input.resource._id;

    // Just in case the user make a GET on url /mainindex/test/_search
    // Without this test we return something weird: a result.hits.hits with all document without filter because the body is empty in HTTP by default
    if (esRequest.id === '_search') {
      return Bluebird.reject(new BadRequestError('The action _search can\'t be done with a GET'));
    }

    return this.client.get(esRequest)
      .then(result => {
        if (result._source && result._source._kuzzle_info && !result._source._kuzzle_info.active && !request.input.args.includeTrash) {
          return Bluebird.reject(new NotFoundError('Document not found'));
        }

        return prepareMetadata(result);
      })
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Return the list of documents matching the ids given in the body param
   * NB: Due to internal Kuzzle mechanism, can only be called on a single index/collection,
   * using the body { ids: [.. } syntax.
   * @param {Request} request
   * @returns {Promise}
   */
  mget(request) {
    const esRequest = initESRequest(request);

    esRequest.body = request.input.body;

    return this.client.mget(esRequest)
      .then(result => {
        // harmonize response format based upon the search one
        if (result.docs) {
          result.hits = request.input.args.includeTrash
            ? result.docs
            : result.docs.filter(doc => doc._kuzzle_info === undefined || doc._kuzzle_info.active);
          delete result.docs;

          result.hits = result.hits.map(obj => prepareMetadata(obj));
        }

        return result;
      })
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Count how many documents match the filter given in body
   * @param {Request} request
   * @returns {Promise} resolve the number of document
   */
  count(request) {
    const esRequest = initESRequest(request);

    esRequest.body = request.input.body;

    if (!request.input.args.includeTrash) {
      addActiveFilter(esRequest);
    }
    return this.client.count(esRequest)
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Sends the new document to elasticsearch
   * Cleans data to match elasticsearch specifications
   *
   * @param {Request} request
   * @returns {Promise} resolve an object that contains _id
   */
  create(request) {
    const esRequest = initESRequest(request, ['refresh']);

    esRequest.id = request.input.resource._id;
    esRequest.body = request.input.body;

    assertNoRouting(esRequest);
    assertWellFormedRefresh(esRequest);

    if (!this.kuzzle.indexCache.exists(esRequest.index, esRequest.type)) {
      return Bluebird.reject(new PreconditionError(`Index '${esRequest.index}' and/or collection '${esRequest.type}' don't exist`));
    }

    // Add metadata
    esRequest.body._kuzzle_info = {
      author: request.context.user._id ? String(request.context.user._id) : null,
      createdAt: Date.now(),
      updatedAt: null,
      updater: null,
      active: true,
      deletedAt: null
    };

    if (esRequest.id) {
      // Check if the document exists and has not been deleted (active: false)
      return this.client.get({index: esRequest.index, type: esRequest.type, id: esRequest.id})
        .then(result => {
          if (result._source._kuzzle_info && !result._source._kuzzle_info.active) {
            // The document is inactive, we replace it and masquerade the result as a creation
            return this.client.index(esRequest)
              .then(res => {
                res.result = 'created';
                res.created = true;

                return this.refreshIndexIfNeeded(esRequest, _.extend(res, {_source: request.input.body}));
              })
              .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
          }

          // The document exits and is active, we reject to prevent the creation
          return Bluebird.reject(new BadRequestError('Document already exists'));
        })
        // Pitfall of all previous rejections
        .catch(err => {
          if (err.displayName === 'NotFound') {
            // The document doesn't exist, we create it
            return this.client.create(esRequest)
              .then(result => this.refreshIndexIfNeeded(esRequest, _.extend(result, {_source: request.input.body})))
              .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
          }

          // A "real" error occurred, we reject it
          return Bluebird.reject(err);
        });
    }

    return this.client.index(esRequest)
      .then(result => this.refreshIndexIfNeeded(esRequest, _.extend(result, {_source: request.input.body})))
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Create a new document to ElasticSearch, or replace it if it already exist
   *
   * @param {Request} request
   * @returns {Promise} resolve an object that contains _id
   */
  createOrReplace(request) {
    const
      esRequest = initESRequest(request, ['refresh']),
      userId = request.context.user._id ? String(request.context.user._id) : null;

    esRequest.id = request.input.resource._id;
    esRequest.body = request.input.body;

    assertNoRouting(esRequest);
    assertWellFormedRefresh(esRequest);

    if (!this.kuzzle.indexCache.exists(esRequest.index, esRequest.type)) {
      return Bluebird.reject(new PreconditionError(`Index '${esRequest.index}' and/or collection '${esRequest.type}' don't exist`));
    }

    // Add metadata
    esRequest.body._kuzzle_info = {
      author: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      updater: userId,
      active: true,
      deletedAt: null
    };

    return this.client.index(esRequest)
      .then(result => this.refreshIndexIfNeeded(esRequest, _.extend(result, {_source: request.input.body})))
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Sends the partial document to elasticsearch
   * with the id to update
   *
   * @param {Request} request
   * @returns {Promise} resolve an object that contains _id
   */
  update(request) {
    const esRequest = initESRequest(request, ['refresh', 'retryOnConflict']);

    esRequest.id = request.input.resource._id;
    esRequest.body = request.input.body;

    assertNoRouting(esRequest);
    assertWellFormedRefresh(esRequest);

    if (!this.kuzzle.indexCache.exists(esRequest.index, esRequest.type)) {
      return Bluebird.reject(new PreconditionError(`Index '${esRequest.index}' and/or collection '${esRequest.type}' don't exist`));
    }

    // injecting retryOnConflict default configuration
    if (!esRequest.hasOwnProperty('retryOnConflict') && this.config.defaults.onUpdateConflictRetries > 0) {
      esRequest.retryOnConflict = this.config.defaults.onUpdateConflictRetries;
    }

    // Add metadata
    esRequest.body._kuzzle_info = {
      active: true,
      updatedAt: Date.now(),
      updater: request.context.user._id ? String(request.context.user._id) : null
    };

    esRequest.body = {doc: esRequest.body};

    return this.client.update(esRequest)
      .then(result => this.refreshIndexIfNeeded(esRequest, result))
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Replace a document to ElasticSearch
   *
   * @param {Request} request
   * @returns {Promise} resolve an object that contains _id
   */
  replace(request) {
    const
      esRequest = initESRequest(request, ['refresh']),
      existQuery = {
        index: esRequest.index,
        type: esRequest.type,
        id: request.input.resource._id
      },
      userId = request.context.user._id ? String(request.context.user._id) : null;

    esRequest.id = request.input.resource._id;
    esRequest.body = request.input.body;

    assertNoRouting(esRequest);
    assertWellFormedRefresh(esRequest);

    if (!this.kuzzle.indexCache.exists(esRequest.index, esRequest.type)) {
      return Bluebird.reject(new PreconditionError(`Index '${esRequest.index}' and/or collection '${esRequest.type}' don't exist`));
    }

    // Add metadata
    esRequest.body._kuzzle_info = {
      author: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      updater: userId,
      active: true,
      deletedAt: null
    };
    // extends the response with the source from request
    // When we write in ES, the response doesn't contain the initial document content
    return this.client.exists(existQuery)
      .then(exists => {
        if (exists) {
          return this.client.index(esRequest);
        }

        return Bluebird.reject(new NotFoundError(`Document with id "${esRequest.id}" not found.`));
      })
      .then(result => this.refreshIndexIfNeeded(esRequest, _.extend(result, {_source: request.input.body})));
  }

  /**
   * Send to elasticsearch the document id to delete
   *
   * @param {Request} request
   * @returns {Promise} resolve an object that contains _id
   */
  delete(request) {
    const esRequest = initESRequest(request, ['refresh', 'retryOnConflict']);

    esRequest.id = request.input.resource._id;

    assertWellFormedRefresh(esRequest);

    // injecting retryOnConflict default configuration
    if (!esRequest.hasOwnProperty('retryOnConflict') && this.config.defaults.onUpdateConflictRetries > 0) {
      esRequest.retryOnConflict = this.config.defaults.onUpdateConflictRetries;
    }

    // Add metadata
    esRequest.body = {
      doc: {
        _kuzzle_info: {
          active: false,
          deletedAt: Date.now(),
          updater: request.context.user._id ? String(request.context.user._id) : null
        }
      }
    };

    return this.client.update(esRequest)
      .then(result => this.refreshIndexIfNeeded(esRequest, result))
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Delete all documents matching the provided filters
   *
   * @param {Request} request
   * @returns {Promise} resolve an object with ids
   */
  deleteByQuery(request) {
    const
      esRequestSearch = initESRequest(request, ['from', 'size', 'scroll']),
      esRequestBulk = initESRequest(request, ['refresh']);

    assertWellFormedRefresh(esRequestBulk);

    esRequestSearch.body = request.input.body;
    esRequestSearch.scroll = '30s';
    esRequestBulk.body = [];

    if (!esRequestSearch.body.query || !(esRequestSearch.body.query instanceof Object)) {
      return Bluebird.reject(new BadRequestError('Query cannot be empty'));
    }

    return getAllIdsFromQuery(this.client, addActiveFilter(esRequestSearch))
      .then(ids => {
        ids.forEach(id => {
          esRequestBulk.body.push({update: {_index: esRequestBulk.index, _type: esRequestBulk.type, _id: id}});
          esRequestBulk.body.push({doc: {_kuzzle_info: { active: false, deletedAt: Date.now(), updater: request.context.user._id ? String(request.context.user._id) : null}}});
        });

        if (esRequestBulk.body.length === 0) {
          return Bluebird.resolve({ids: []});
        }

        return this.client.bulk(esRequestBulk)
          .then(() => this.refreshIndexIfNeeded(esRequestBulk, {ids}))
          .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
      });
  }

  /**
   * Delete all document that match the given filter from the trash
   * @param {Request} request
   * @returns {Promise}
   */
  deleteByQueryFromTrash(request) {
    const
      esRequestSearch = initESRequest(request, ['from', 'size', 'scroll']),
      esRequestBulk = initESRequest(request, ['refresh']);

    assertWellFormedRefresh(esRequestBulk);

    esRequestSearch.body = request.input.body;
    esRequestSearch.scroll = '30s';
    esRequestBulk.body = [];

    if (esRequestSearch.body.query === null) {
      return Bluebird.reject(new BadRequestError('null is not a valid document ID'));
    }

    return getAllIdsFromQuery(this.client, esRequestSearch)
      .then(ids => {
        return new Bluebird((resolve, reject) => {
          ids.forEach(id => {
            esRequestBulk.body.push({delete: {_index: esRequestBulk.index, _type: esRequestBulk.type, _id: id}});
          });

          if (esRequestBulk.body.length === 0) {
            return resolve({ids: []});
          }
          return this.client.bulk(esRequestBulk)
            .then(() => this.refreshIndexIfNeeded(esRequestBulk, {ids}))
            .catch(error => reject(this.esWrapper.formatESError(error)));
        });
      });
  }

  /**
   * Create an empty collection with no mapping
   *
   * @param {Request} request
   * @returns {Promise}
   */
  createCollection(request) {
    const esRequest = initESRequest(request);

    esRequest.body = {
      [esRequest.type]: {}
    };

    if (!this.kuzzle.indexCache.exists(esRequest.index)) {
      return Bluebird.reject(new PreconditionError(`Index '${esRequest.index}' doesn't exist`));
    }

    return this.client.indices.putMapping(esRequest)
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
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
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Run several action and document
   *
   * @param {Request} request
   * @returns {Promise}
   */
  import(request) {
    const
      nameActions = ['index', 'create', 'update', 'delete'],
      esRequest = initESRequest(request, ['consistency', 'refresh', 'timeout', 'fields']);
    let error = null;

    assertWellFormedRefresh(esRequest);

    if (!request.input.body || !(request.input.body.bulkData instanceof Object)) {
      return Bluebird.reject(new BadRequestError('import must specify a body attribute "bulkData" of type Object.'));
    }

    esRequest.body = request.input.body.bulkData;

    // set missing index & type if possible
    esRequest.body.forEach(item => {
      const action = Object.keys(item)[0];

      if (nameActions.indexOf(action) !== -1) {
        if (!item[action]._type && esRequest.type) {
          item[action]._type = esRequest.type;
        }

        if (!item[action]._type) {
          error = new BadRequestError('Missing data collection argument');
        }

        if (!item[action]._index && esRequest.index) {
          item[action]._index = esRequest.index;
        }

        if (!item[action]._index) {
          error = new BadRequestError('Missing data index argument');
          return false;
        }

        if (!this.kuzzle.indexCache.exists(item[action]._index, item[action]._type)) {
          error = new PreconditionError(`Index '${esRequest.index}' and/or collection ${esRequest.type} don't exist`);
          return false;
        }

        if (item[action]._index === this.kuzzle.internalEngine.index) {
          error = new BadRequestError(`Index "${this.kuzzle.internalEngine.index}" is protected, please use appropriated routes instead`);
          return false;
        }
      }
    });

    if (error) {
      return Bluebird.reject(error);
    }

    return this.client.bulk(esRequest)
      .then(response => this.refreshIndexIfNeeded(esRequest, response))
      .then(result => {
        // If some errors occured during the Bulk, we send a "Partial Error" response :
        if (result.errors) {
          result.partialErrors = [];

          for (const resultItem of Object.keys(result.items)) {
            for (const action of Object.keys(result.items[resultItem])) {
              const item = result.items[resultItem][action];

              if (item.error) {
                item.action = action;
                result.partialErrors.push(item);
              }
            }
          }
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

    esRequest.body = request.input.body;

    return this.client.indices.putMapping(esRequest)
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * Retrieve mapping definition for index/type
   *
   * @param {Request} request
   * @return {Promise}
   */
  getMapping(request) {
    const esRequest = initESRequest(request);

    return this.esWrapper.getMapping(esRequest);
  }

  /**
   * Retrieve the complete list of existing data collections in the current index
   *
   * @param {Request} request
   * @return {Promise}
   */
  listCollections(request) {
    const esRequest = initESRequest(request);

    return this.client.indices.getMapping(esRequest)
      .then(result => {
        let collections = [];

        if (result[request.input.resource.index]) {
          collections = Object.keys(result[request.input.resource.index].mappings);
        }

        return {collections: {stored: collections}};
      })
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
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
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * List all known indexes
   *
   * @returns {Promise}
   */
  listIndexes() {
    return this.client.indices.getMapping()
      .then(result => ({
        indexes: Object.keys(result).filter(indexName => indexName !== '' && indexName[0] !== '%')
      }))
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
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
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
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
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
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
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * @param {Request} request
   * @returns {Promise}
   */
  indexExists(request) {
    const esRequest = initESRequest(request);

    return this.client.indices.exists(esRequest)
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
  }

  /**
   * @param {Request} request
   * @returns {Promise}
   */
  collectionExists(request) {
    const esRequest = initESRequest(request);

    return this.client.indices.existsType(esRequest)
      .catch(error => Bluebird.reject(this.esWrapper.formatESError(error)));
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
   * Triggers an refresh call on the index set in the data request if the autoRefresh is on.
   * Else, passes the response through.
   *
   * @this ElasticSearch
   * @param {object} esRequest
   * @param {object} response The response from elasticsearch
   * @returns {Promise}
   */
  refreshIndexIfNeeded(esRequest, response) {
    if (esRequest && esRequest.index && this.settings.autoRefresh[esRequest.index]) {
      return this.refreshIndex(new Request({index: esRequest.index}))
        .then(() => response)
        .catch(error => {
          // index refresh failures are non-blocking
          this.kuzzle.pluginsManager.trigger(
            'log:error',
            new KuzzleInternalError(`Error refreshing index ${esRequest.index}:\n${error.message}`)
          );

          return Bluebird.resolve(prepareMetadata(response));
        });
    }

    return Bluebird.resolve(prepareMetadata(response));
  }
}

module.exports = ElasticSearch;

/**
 * Builds a request formatted for Elasticsearch service
 * and map the name 'collection' to 'type' for ES
 *
 * @param {Request} request
 * @param {Array} [extraParams] [optional] An array of String values corresponding
 *                            to the extra params from the Kuzzle Request to be
 *                            included in the Elasticsearch Request.
 * @return {object} data the data with cleaned attributes
 */
function initESRequest(request, extraParams = []) {
  const
    data = {},
    index = getIndex(request);

  if (index) {
    data.index = index;
  }

  if (request.input.resource.collection) {
    data.type = request.input.resource.collection;
  }

  extraParams.forEach(argumentName => {
    if (typeof request.input.args[argumentName] !== 'undefined') {
      data[argumentName] = request.input.args[argumentName];
    }
  });

  return data;
}

/**
 * Extracts the index from the provided request.
 * Throws if it refers to an internal index
 *
 * @param {Request} request
 * @return {string}
 * @throws {BadRequestError}
 */
function getIndex(request) {
  if (request.input.resource.index && request.input.resource.index[0] === '%') {
    throw new BadRequestError(`Indexes starting with a "%" are reserved for internal use. Cannot process index ${request.input.resource.index}.`);
  }

  return request.input.resource.index;
}

/**
 * Scroll index in elasticsearch and return all document ids that match the filter
 *
 * @param {object} client - elasticsearch client
 * @param {object} esRequest
 * @returns {Promise} resolve to an array of documents IDs
 */
function getAllIdsFromQuery(client, esRequest) {
  const ids = [];

  return new Bluebird((resolve, reject) => {
    client.search(esRequest, function getMoreUntilDone(error, response) {
      if (error) {
        return reject(error);
      }

      response.hits.hits.forEach(hit => ids.push(hit._id));

      if (response.hits.total !== ids.length) {
        client.scroll({
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
 * Remove depth in object (replace hits.hits<array>, with hits<array>)
 * Move _kuzzle_info from the document body to the root as _meta
 *
 * @param result
 * @returns {object}
 */
function flattenSearchResults(result) {
  const _result = result.hits ? _.extend(result, result.hits) : result;

  _result.hits = _result.hits.map(obj => prepareMetadata(obj));

  return _result;
}

/**
 * Move _kuzzle_info to root attribute _meta
 *
 * @param response
 * @return {object}
 */
function prepareMetadata(response) {
  if (response._source && response._source._kuzzle_info) {
    response._meta = response._source._kuzzle_info;
    delete response._source._kuzzle_info;
  }

  return response;
}

/**
 * Returns a new elasticsearch client instance
 *
 * @param {object} config - ES client options
 * @returns {object}
 */
function buildClient(config) {
  let options;

  // Passed to Elasticsearch's client to make it use 
  // Bluebird instead of ES6 promises
  const defer = function defer () {
    let resolve, reject;
    const
      promise = new Bluebird((res, rej) => {
        resolve = res;
        reject = rej;
      });

    return {resolve, reject, promise};
  };

  if (config.client) {
    options = Object.assign({defer}, config.client);
  }
  else {
    // keep compatibility layer for the time being
    // @todo: once the install base is clean, remove this
    options = {
      defer,
      hosts: config.hosts || config.host + ':' + config.port,
      apiVersion: config.apiVersion
    };
  }

  return new es.Client(options);
}

/**
 * Forbid the use of the _routing ES option
 * @param {object} esRequest
 * @throws
 */
function assertNoRouting(esRequest) {
  if (esRequest.body._routing) {
    throw new BadRequestError('Kuzzle does not support "_routing" in create action.');
  }
}

/**
 * Checks if the optional "refresh" argument is well-formed
 *
 * @param {object} esRequest
 * @throws
 */
function assertWellFormedRefresh(esRequest) {
  if (esRequest.hasOwnProperty('refresh')
    && ['wait_for', 'false', false].indexOf(esRequest.refresh) < 0
  ) {
    throw new BadRequestError('Refresh parameter only supports the value "wait_for" or false');
  }
}
