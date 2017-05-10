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
  debug = require('../kuzzleDebug')('kuzzle:services:elasticsearch'),
  _ = require('lodash'),
  Bluebird = require('bluebird'),
  Service = require('./service'),
  Request = require('kuzzle-common-objects').Request,
  es = require('elasticsearch'),
  ms = require('ms'),
  compareVersions = require('compare-versions'),
  {
    BadRequestError,
    InternalError: KuzzleInternalError,
    ServiceUnavailableError,
    NotFoundError,
    KuzzleError,
    ExternalServiceError
  } = require('kuzzle-common-objects').errors;

const scrollCachePrefix = '_docscroll_';

const errorMessagesMapping = [
  {
    // [illegal_argument_exception] object mapping [titi] can't be changed from nested to non-nested
    regex: /^\[illegal_argument_exception] object mapping \[(.*?)] can't be changed from nested to non-nested$/,
    replacement: 'Can not change mapping for field "$1" from nested to another type'
  },
  {
    // [illegal_argument_exception] object mapping [baz] can't be changed from non-nested to nested
    regex: /^\[illegal_argument_exception] object mapping \[(.*?)] can't be changed from non-nested to nested$/,
    replacement: 'Can not change mapping for field "$1" from object to another type'
  },
  {
    // [illegal_argument_exception] Can't merge a non object mapping [aeaze] with an object mapping [aeaze]
    regex: /^\[illegal_argument_exception] Can't merge a non object mapping \[(.*?)] with an object mapping \[(.*?)]$/,
    replacement: 'Can not change mapping for field "$1" from object to a scalar type'
  },
  {
    // [illegal_argument_exception] [tutu.tutu] is defined as an object in mapping [aze] but this name is already used for a field in other types
    regex: /^\[illegal_argument_exception] \[(.*?)] is defined as an object in mapping \[(.*?)] but this name is already used for a field in other types$/,
    replacement: 'Can not set mapping for field "$1" on collection "$2" because the field name is already used in another collection with a different type'
  },
  {
    // [illegal_argument_exception] mapper [source.flags] of different type, current_type [string], merged_type [long]
    regex: /^\[illegal_argument_exception] mapper \[(.*?)] of different type, current_type \[(.*?)], merged_type \[(.*?)]$/,
    replacement: 'Can not change type of field "$1" from "$2" to "$3"'
  },
  {
    // [mapper_parsing_exception] Mapping definition for [flags] has unsupported parameters:  [index : not_analyzed]
    // eslint-disable-next-line no-regex-spaces
    regex: /^\[mapper_parsing_exception] Mapping definition for \[(.*?)] has unsupported parameters:  \[(.*?)]$/,
    replacement: 'Parameter "$2" is not supported for field "$1"'
  },
  {
    // [mapper_parsing_exception] No handler for type [booleasn] declared on field [not]
    regex: /^\[mapper_parsing_exception] No handler for type \[(.*?)] declared on field \[(.*?)]$/,
    replacement: 'Can not set mapping for field "$2" because type "$1" does not exist'
  },
  {
    // [mapper_parsing_exception] failed to parse [conditions.host.flags]
    regex: /^\[mapper_parsing_exception] failed to parse \[(.*?)]$/,
    replacement: 'Failed to validate value of field "$1". Are you trying to insert nested value in a non-nested field ?'
  },
  {
    // [index_not_found_exception] no such index, with { resource.type=index_or_alias & resource.id=foso & index=foso }
    regex: /^\[index_not_found_exception] no such index, with { resource\.type=([^\s]+) (& )?resource\.id=([^\s]+) (& )?(index_uuid=.* )?index=([^\s]+) }$/,
    replacement: 'Index "$3" does not exist, please create it first'
  },
  {
    // [mapper_parsing_exception] Expected map for property [fields] on field [foo] but got a class java.lang.String
    regex: /^\[mapper_parsing_exception] Expected map for property \[fields] on field \[(.*?)] but got a class java\.lang\.String$/,
    replacement: 'Mapping for field "$1" must be an object with a property "type"'
  },
  {
    regex: /^\[version_conflict_engine_exception] \[data]\[(.*?)]: version conflict.*$/,
    replacement: 'Unable to modify document "$1": cluster sync failed (too many simultaneous changes applied)'
  }
];

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

    return Bluebird.resolve(this.client.info())
      .then(response => {
        this.esVersion = response.version;

        if (this.esVersion && compareVersions(this.esVersion.number, '5.0.0') < 0) {
          return Bluebird.reject(`Your elasticsearch version is ${this.esVersion.number}; Only elasticsearch version 5.0.0 and above are supported.`);
        }

        return Bluebird.resolve(this);
      });
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
      .catch(error => Bluebird.reject(this.formatESError(error)));
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
      .catch(error => Bluebird.reject(this.formatESError(error)));
  }

  /**
   * Search documents from elasticsearch with a query
   * @param {Request} request
   * @returns {Promise} resolve documents matching the filter
   */
  search(request) {
    const esRequest = initESRequest(request, ['from', 'size', 'scroll']);

    esRequest.body = request.input.body;

    // todo add condition once the 'trash' feature has been implemented
    addActiveFilter(esRequest);

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
      .catch(error => Bluebird.reject(this.formatESError(error)));
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
        if (result._source) {
          if (result._source._kuzzle_info && !result._source._kuzzle_info.active) {
            // todo Feedback how to get it from the 'trash' once it is implemented
            return Bluebird.reject(new NotFoundError(`Document ${result._id} was already deleted`));
          }
          if (result._source._kuzzle_info) {
            result._meta = result._source._kuzzle_info;
            delete result._source._kuzzle_info;
          }
        }

        return result;
      })
      .catch(error => Bluebird.reject(this.formatESError(error)));
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
          result.hits = result.docs;
          delete result.docs;
        }

        return result;
      })
      .catch(error => Bluebird.reject(this.formatESError(error)));
  }

  /**
   * Count how many documents match the filter given in body
   * @param {Request} request
   * @returns {Promise} resolve the number of document
   */
  count(request) {
    const esRequest = initESRequest(request);

    esRequest.body = request.input.body;

    // todo add condition once the 'trash' feature has been implemented
    addActiveFilter(esRequest);
    return this.client.count(esRequest)
      .catch(error => Bluebird.reject(this.formatESError(error)));
  }

  /**
   * Send to elasticsearch the new document
   * Clean data for match the elasticsearch specification
   *
   * @param {Request} request
   * @returns {Promise} resolve an object that contains _id
   */
  create(request) {
    const esRequest = initESRequest(request, ['refresh']);

    esRequest.id = request.input.resource._id;
    esRequest.body = request.input.body;

    assertNoRouting(esRequest);
    assertWellFormedRefresh(this.config.apiVersion, esRequest);

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
              .catch(error => Bluebird.reject(this.formatESError(error)));
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
              .catch(error => Bluebird.reject(this.formatESError(error)));
          }

          // A "real" error occured, we reject it
          return Bluebird.reject(err);
        });
    }

    return this.client.index(esRequest)
      .then(result => this.refreshIndexIfNeeded(esRequest, _.extend(result, {_source: request.input.body})))
      .catch(error => Bluebird.reject(this.formatESError(error)));
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
    assertWellFormedRefresh(this.config.apiVersion, esRequest);

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
      .catch(error => Bluebird.reject(this.formatESError(error)));
  }

  /**
   * Send to elasticsearch the partial document
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
    assertWellFormedRefresh(this.config.apiVersion, esRequest);

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
      .catch(error => Bluebird.reject(this.formatESError(error)));
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
    assertWellFormedRefresh(this.config.apiVersion, esRequest);

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
    // When we write in ES, the response from it doesn't contain the initial document content
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
    const esRequest = initESRequest(request, ['refresh']);

    esRequest.id = request.input.resource._id;

    assertWellFormedRefresh(this.config.apiVersion, esRequest);

    // todo do not delete the document but pass active to false
    return this.client.delete(esRequest)
      .then(result => this.refreshIndexIfNeeded(esRequest, result))
      .catch(error => Bluebird.reject(this.formatESError(error)));
  }

  /**
   * Delete all document that match the given filter
   *
   * @param {Request} request
   * @returns {Promise} resolve an object with ids
   */
  deleteByQuery(request) {
    const
      esRequestSearch = initESRequest(request, ['from', 'size', 'scroll']),
      esRequestBulk = initESRequest(request, ['refresh']);

    assertWellFormedRefresh(this.config.apiVersion, esRequestBulk);

    esRequestSearch.body = request.input.body;
    esRequestSearch.scroll = '30s';
    esRequestBulk.body = [];

    if (!esRequestSearch.body.query || !(esRequestSearch.body.query instanceof Object)) {
      return Bluebird.reject(new BadRequestError('Query cannot be empty'));
    }

    return getAllIdsFromQuery(this.client, esRequestSearch)
      .then(ids => {
        ids.forEach(id => {
          esRequestBulk.body.push({update: {_index: esRequestBulk.index, _type: esRequestBulk.type, _id: id}});
          esRequestBulk.body.push({doc: {_kuzzle_info: { active: false, deletedAt: Date.now() }}});
        });

        if (esRequestBulk.body.length === 0) {
          return Bluebird.resolve({ids: []});
        }

        return this.client.bulk(esRequestBulk)
          .then(() => this.refreshIndexIfNeeded(esRequestBulk, {ids}))
          .catch(error => Bluebird.reject(this.formatESError(error)));
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

    assertWellFormedRefresh(this.config.apiVersion, esRequestBulk);

    esRequestSearch.body = request.input.body;
    esRequestSearch.scroll = '30s';
    esRequestBulk.body = [];

    if (esRequestSearch.body.query === null) {
      return Bluebird.reject(new BadRequestError('null is not a valid document ID'));
    }

    return getPaginatedIdsFromQuery(this.client, esRequestSearch)
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
            .catch(error => reject(this.formatESError(error)));
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

    return this.client.indices.putMapping(esRequest)
      .catch(error => Bluebird.reject(this.formatESError(error)));
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
      });

    return this.deleteByQuery(deleteRequest)
      .catch(error => Bluebird.reject(this.formatESError(error)));
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

    assertWellFormedRefresh(this.config.apiVersion, esRequest);

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

          Object.keys(result.items).forEach(resultItem => {
            Object.keys(result.items[resultItem]).forEach(action => {
              const item = result.items[resultItem][action];

              if (item.error) {
                item.action = action;
                result.partialErrors.push(item);
              }
            });
          });
        }

        return result;
      })
      .catch(err => Bluebird.reject(this.formatESError(err)));
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
      .catch(error => Bluebird.reject(this.formatESError(error)));
  }

  /**
   * Retrieve mapping definition for index/type
   *
   * @param {Request} request
   * @return {Promise}
   */
  getMapping(request) {
    const esRequest = initESRequest(request);

    return this.client.indices.getMapping(esRequest)
      .then(result => {
        if (result[request.input.resource.index]) {
          if (result[request.input.resource.index].mappings[request.input.resource.collection].properties) {
            delete result[request.input.resource.index].mappings[request.input.resource.collection].properties._kuzzle_info;
          }

          return result;
        }

        return Bluebird.reject(new NotFoundError(`No mapping for index "${request.input.resource.index}"`));
      })
      .catch(error => Bluebird.reject(this.formatESError(error)));
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
      .catch(error => Bluebird.reject(this.formatESError(error)));
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
      .catch(error => Bluebird.reject(this.formatESError(error)));
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
      .catch(error => Bluebird.reject(this.formatESError(error)));
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
      .catch(error => Bluebird.reject(this.formatESError(error)));
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
      .catch(error => Bluebird.reject(this.formatESError(error)));
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
      .catch(error => Bluebird.reject(this.formatESError(error)));
  }

  /**
   * @param {Request} request
   * @returns {Promise}
   */
  indexExists(request) {
    const esRequest = initESRequest(request);

    return this.client.indices.exists(esRequest)
      .catch(error => Bluebird.reject(this.formatESError(error)));
  }

  /**
   * @param {Request} request
   * @returns {Promise}
   */
  collectionExists(request) {
    const esRequest = initESRequest(request);

    return this.client.indices.existsType(esRequest)
      .catch(error => Bluebird.reject(this.formatESError(error)));
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
   * Transforms raw ES errors into a normalized Kuzzle version
   *
   * @param {Error} error
   * @returns {KuzzleError}
   */
  formatESError(error) {
    let
      kuzzleError,
      messageReplaced,
      message = error.message || '';

    if (error instanceof KuzzleError) {
      return error;
    }

    if (error instanceof es.errors.NoConnections) {
      return new ServiceUnavailableError('Elasticsearch service is not connected');
    }

    messageReplaced = errorMessagesMapping.some(mapping => {
      message = message.replace(mapping.regex, mapping.replacement);
      return message !== error.message;
    });

    switch (error.displayName) {
      case 'BadRequest':
        if (!messageReplaced) {
          if (error.body && error.body.error) {
            message = error.body.error.root_cause ? error.body.error.root_cause[0].reason : error.body.error.reason;
          }

          debug('unhandled "BadRequest" elasticsearch error: %a', error);
        }

        kuzzleError = new BadRequestError(message);
        break;
      case 'NotFound':
        if (!messageReplaced) {
          if (error.body && error.body.error) {
            message = error.body.error
              ? error.body.error.reason + ': ' + error.body.error['resource.id']
              : error.message + ': ' + error.body._id;
          }

          debug('unhandled "NotFound" elasticsearch error: %a', error);
        }

        kuzzleError = new NotFoundError(message);
        break;
      case 'Conflict':
        if (!messageReplaced) {
          debug('unhandled "Conflict" elasticsearch error: %a', error);
        }

        kuzzleError = new ExternalServiceError(message);
        break;
      default:
        kuzzleError = new ExternalServiceError(message);

        debug('unhandled default elasticsearch error: %a', message);
        break;
    }

    kuzzleError.internalError = error;
    kuzzleError.service = 'elasticsearch';

    return kuzzleError;
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

          return Bluebird.resolve(response);
        });
    }

    return Bluebird.resolve(response);
  }
}

module.exports = ElasticSearch;

/**
 * Builds a resquest formatted for Elasticsearch service
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
 * @returns {Promise} resolve an array
 */
function getAllIdsFromQuery(client, esRequest) {
  const ids = [];

  return new Bluebird((resolve, reject) => {
    client.search(esRequest, function getMoreUntilDone(error, response) {
      if (error) {
        return reject(error);
      }

      response.hits.hits.forEach(hit => {
        ids.push(hit._id);
      });

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
 * Scroll index in elasticsearch and return all document ids that match the filter
 *
 * @param {object} client - elasticseach client
 * @param {Object} data
 * @returns {Promise} resolve an array
 */
function getPaginatedIdsFromQuery(client, data) {
  return new Bluebird((resolve, reject) => {
    client.search(data, function getMoreUntilDone(error, response) {
      if (error) {
        return reject(error);
      }

      // todo: use real scroll here
      resolve(response.hits.hits.map(hit => hit._id));
    });
  });
}

/**
 * Add filter to get only the active documents
 * @param {object} esRequest
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

  _result.hits = _result.hits.map(obj => {
    if (obj._source && obj._source._kuzzle_info) {
      // Move _kuzzle_info from the document body to the root as _meta
      obj._meta = obj._source._kuzzle_info;
      delete obj._source._kuzzle_info;
    }

    return obj;
  });

  return _result;
}

/**
 * Returns a new elasticsearch client instance
 *
 * @param {object} config - ES client options
 * @returns {object}
 */
function buildClient(config) {
  return new es.Client({
    hosts: config.hosts || config.host + ':' + config.port,
    apiVersion: config.apiVersion
  });
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
 * @param {string} version - ES API version
 * @param {object} esRequest
 * @throws
 */
function assertWellFormedRefresh(version, esRequest) {
  if (esRequest.hasOwnProperty('refresh')) {
    if (compareVersions(version, '5.0') < 0) {
      throw new BadRequestError(`Refresh parameter is not supported by the version "${version}" of Elasticsearch API`);
    }
    if (esRequest.refresh !== 'wait_for' && esRequest.refresh !== 'false' && esRequest.refresh !== false) {
      throw new BadRequestError('Refresh parameter only supports the value "wait_for" or false');
    }
  }
}
