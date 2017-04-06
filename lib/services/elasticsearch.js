var
  _ = require('lodash'),
  Promise = require('bluebird'),
  util = require('util'),
  Service = require('./service'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  KuzzleError = require('kuzzle-common-objects').errors.KuzzleError,
  Request = require('kuzzle-common-objects').Request,
  es = require('elasticsearch'),
  compareVersions = require('compare-versions');

/**
 * @property {Kuzzle} kuzzle
 * @property {object} settings
 * @property {object} client
 * @param {Kuzzle} kuzzle kuzzle instance
 * @param {object} options used to start the service
 * @param {object} config used to start the service
 * @constructor
 */
function ElasticSearch (kuzzle, options, config) {
  Object.defineProperties(this, {
    kuzzle: {
      value: kuzzle
    },
    settings: {
      writable: true,
      value: {
        service: options.service,
        autoRefresh: options.autoRefresh || {}
      }
    },
    client: {
      writable: true,
      value: null
    },
    esVersion: {
      writable: true,
      value: null
    }
  });

  this.errorMessagesMapping = [
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
      // [index_not_found_exception] no such index, with { resource.type=index_or_alias resource.id=foso index=foso }
      regex: /^\[index_not_found_exception] no such index, with { resource\.type=([^\s]+) resource\.id=([^\s]+) (index_uuid=.* )?index=([^\s]+) }$/,
      replacement: 'Index "$2" does not exist, please create it first'
    },
    {
      // [mapper_parsing_exception] Expected map for property [fields] on field [foo] but got a class java.lang.String
      regex: /^\[mapper_parsing_exception] Expected map for property \[fields] on field \[(.*?)] but got a class java\.lang\.String$/,
      replacement: 'Mapping for field "$1" must be an object with a property "type"'
    },
    {
      // [search_context_missing_exception] No search context found for id [154] (and) ...
      regex: /^\[search_context_missing_exception] No search context found for id(.*)+/,
      replacement: 'Unable to execute scroll request: scrollId seems to be outdated'
    },
  ];

  /**
   * Initialize the elasticsearch client
   *
   * @returns {Promise}
   */
  this.init = function elasticsearchInit () {
    var
      self = this;

    if (this.client) {
      return Promise.resolve(this);
    }

    this.client = buildClient(config);

    return Promise.resolve(this.client.info())
      .then(response => {
        // This information will be usefull alongside the api version in order to allow ES 5.x features
        this.esVersion = response.version;

        return Promise.resolve(self);
      });
  };

  /**
   * Return some basic information about this service
   *
   * @returns {Promise} service informations
   */
  this.getInfos = function elasticsearchGetInfos () {
    var response = {
      type: 'elasticsearch',
      api: config.apiVersion
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
      .catch(error => Promise.reject(this.formatESError(error)));
  };


  /**
   * Scroll results from previous elasticsearch query
   * @param {Request} request
   * @returns {Promise} resolve documents matching the scroll id
   */
  this.scroll = function elasticsearchScroll (request) {
    const esRequest = getElasticsearchRequest(request, this.kuzzle);

    if (!esRequest.scroll) {
      esRequest.scroll = this.kuzzle.config.services.db.defaults.scrollTTL;
    }

    return this.client.scroll(esRequest)
      .then(result => flattenSearchResults(result))
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Search documents from elasticsearch with a query
   * @param {Request} request
   * @returns {Promise} resolve documents matching the filter
   */
  this.search = function elasticsearchSearch (request) {
    const esRequest = getElasticsearchRequest(request, this.kuzzle);

    // todo add condition once the 'trash' feature has been implemented
    addActiveFilter(esRequest);

    return this.client.search(esRequest)
      .then(result => flattenSearchResults(result))
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Get the document with given ID
   * @param {Request} request
   * @returns {Promise} resolve the document
   */
  this.get = function elasticsearchGet (request) {
    var esRequest = getElasticsearchRequest(request, this.kuzzle);

    delete esRequest.body;

    // Just in case the user make a GET on url /mainindex/test/_search
    // Without this test we return something weird: a result.hits.hits with all document without filter because the body is empty in HTTP by default
    if (esRequest.id === '_search') {
      return Promise.reject(new BadRequestError('The action _search can\'t be done with a GET'));
    }

    return this.client.get(esRequest)
      .then(result => {
        if (result._source) {
          if (result._source._kuzzle_info && !result._source._kuzzle_info.active) {
            // todo Feedback how to get it from the 'trash' once it is implemented
            return Promise.reject(new NotFoundError(`Document ${result._id} was already deleted`));
          }
          if (result._source._kuzzle_info) {
            result._kuzzle_info = result._source._kuzzle_info;
            delete result._source._kuzzle_info;
          }
        }

        return result;
      })
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Return the list of documents matching the ids given in the body param
   * NB: Due to internal Kuzzle mechanism, can only be called on a single index/collection,
   * using the body { ids: [.. } syntax.
   * @param {Request} request
   * @returns {Promise}
   */
  this.mget = function elasticsearchMget (request) {
    var esRequest = getElasticsearchRequest(request, this.kuzzle);

    return this.client.mget(esRequest)
      .then(result => {
        // harmonize response format based upon the search one
        if (result.docs) {
          result.hits = result.docs;
          delete result.docs;
        }

        return result;
      })
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Count how many documents match the filter given in body
   * @param {Request} request
   * @returns {Promise} resolve the number of document
   */
  this.count = function elasticsearchCount (request) {
    var esRequest = getElasticsearchRequest(request, kuzzle);

    // todo add condition once the 'trash' feature has been implemented
    addActiveFilter(esRequest);
    return this.client.count(esRequest)
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Send to elasticsearch the new document
   * Clean data for match the elasticsearch specification
   *
   * @param {Request} request
   * @returns {Promise} resolve an object that contains _id
   */
  this.create = function elasticsearchCreate (request) {
    var esRequest = getElasticsearchRequest(request, kuzzle);

    if (esRequest.body._routing) {
      return Promise.reject(new BadRequestError('Kuzzle does not support "_routing" in create action.'));
    }

    if (esRequest.hasOwnProperty('refresh')) {
      if (this.esVersion && compareVersions(this.esVersion.number, '5.0.0') < 0) {
        return Promise.reject(new BadRequestError(`Refresh parameter is not supported by the version "${this.esVersion.number}" of Elasticsearch`));
      }
      if (compareVersions(config.apiVersion, '5.0') < 0) {
        return Promise.reject(new BadRequestError(`Refresh parameter is not supported by the version "${config.apiVersion}" of Elasticsearch API`));
      }
      if (esRequest.refresh !== 'wait_for' && esRequest.refresh !== 'false' && esRequest.refresh !== false) {
        return Promise.reject(new BadRequestError('Refresh parameter only supports the value "wait_for" or false'));
      }
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

                return refreshIndexIfNeeded.call(this, esRequest, _.extend(res, {_source: request.input.body}));
              })
              .catch(error => {
                return Promise.reject(this.formatESError(error));
              });
          }

          // The document exits and is active, we reject to prevent the creation
          return Promise.reject(new BadRequestError('Document already exists'));
        })
        // Pitfall of all previous rejections
        .catch(err => {
          if (err.displayName === 'NotFound') {
            // The document doesn't exist, we create it
            return this.client.create(esRequest)
              .then(result => refreshIndexIfNeeded.call(this, esRequest, _.extend(result, {_source: request.input.body})))
              .catch(error => Promise.reject(this.formatESError(error)));
          }

          // A "real" error occured, we reject it
          return Promise.reject(err);
        });
    }

    return this.client.index(esRequest)
      .then(result => refreshIndexIfNeeded.call(this, esRequest, _.extend(result, {_source: request.input.body})))
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Create a new document to ElasticSearch, or replace it if it already exist
   *
   * @param {Request} request
   * @returns {Promise} resolve an object that contains _id
   */
  this.createOrReplace = function elasticsearchCreateOrReplace (request) {
    var esRequest = getElasticsearchRequest(request, kuzzle);

    if (esRequest.body._routing) {
      return Promise.reject(new BadRequestError('Kuzzle does not support "_routing" in createOrReplace action.'));
    }

    if (esRequest.hasOwnProperty('refresh')) {
      if (this.esVersion && compareVersions(this.esVersion.number, '5.0.0') < 0) {
        return Promise.reject(new BadRequestError(`Refresh parameter is not supported by the version "${this.esVersion.number}" of Elasticsearch`));
      }
      if (compareVersions(config.apiVersion, '5.0') < 0) {
        return Promise.reject(new BadRequestError(`Refresh parameter is not supported by the version "${config.apiVersion}" of Elasticsearch API`));
      }
      if (esRequest.refresh !== 'wait_for' && esRequest.refresh !== 'false' && esRequest.refresh !== false) {
        return Promise.reject(new BadRequestError('Refresh parameter only supports the value "wait_for" or false'));
      }
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

    return this.client.index(esRequest)
      .then(result => refreshIndexIfNeeded.call(this, esRequest, _.extend(result, {_source: request.input.body})))
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Send to elasticsearch the partial document
   * with the id to update
   *
   * @param {Request} request
   * @returns {Promise} resolve an object that contains _id
   */
  this.update = function elasticsearchUpdate (request) {
    var esRequest = getElasticsearchRequest(request, kuzzle);

    if (esRequest.body._routing) {
      return Promise.reject(new BadRequestError('Kuzzle does not support "_routing" in update action.'));
    }

    if (esRequest.hasOwnProperty('refresh')) {
      if (this.esVersion && compareVersions(this.esVersion.number, '5.0.0') < 0) {
        return Promise.reject(new BadRequestError(`Refresh parameter is not supported by the version "${this.esVersion.number}" of Elasticsearch`));
      }
      if (compareVersions(config.apiVersion, '5.0') < 0) {
        return Promise.reject(new BadRequestError(`Refresh parameter is not supported by the version "${config.apiVersion}" of Elasticsearch API`));
      }
      if (esRequest.refresh !== 'wait_for' && esRequest.refresh !== 'false' && esRequest.refresh !== false) {
        return Promise.reject(new BadRequestError('Refresh parameter only supports the value "wait_for" or false'));
      }
    }

    // Add metadata
    esRequest.body._kuzzle_info = {
      active: true,
      updatedAt: Date.now(),
      updater: request.context.user._id ? String(request.context.user._id) : null
    };

    esRequest.body = {doc: esRequest.body};

    return this.client.update(esRequest)
      .then(result => refreshIndexIfNeeded.call(this, esRequest, result))
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Replace a document to ElasticSearch
   *
   * @param {Request} request
   * @returns {Promise} resolve an object that contains _id
   */
  this.replace = function elasticsearchReplace (request) {
    var
      esRequest = getElasticsearchRequest(request, kuzzle),
      existQuery = {
        index: esRequest.index,
        type: esRequest.type,
        id: esRequest.id
      };

    if (esRequest.body._routing) {
      return Promise.reject(new BadRequestError('Kuzzle does not support "_routing" in replace action.'));
    }

    if (esRequest.hasOwnProperty('refresh')) {
      if (this.esVersion && compareVersions(this.esVersion.number, '5.0.0') < 0) {
        return Promise.reject(new BadRequestError(`Refresh parameter is not supported by the version "${this.esVersion.number}" of Elasticsearch`));
      }
      if (compareVersions(config.apiVersion, '5.0') < 0) {
        return Promise.reject(new BadRequestError(`Refresh parameter is not supported by the version "${config.apiVersion}" of Elasticsearch API`));
      }
      if (esRequest.refresh !== 'wait_for' && esRequest.refresh !== 'false' && esRequest.refresh !== false) {
        return Promise.reject(new BadRequestError('Refresh parameter only supports the value "wait_for" or false'));
      }
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
    // extends the response with the source from request
    // When we write in ES, the response from it doesn't contain the initial document content
    return this.client.exists(existQuery)
      .then((exists) => {
        if (exists) {
          return this.client.index(esRequest);
        }

        return Promise.reject(new NotFoundError('Document with id ' + esRequest.id + ' not found.'));
      })
      .then(result => refreshIndexIfNeeded.call(this, esRequest, _.extend(result, {_source: request.input.body})));
  };

  /**
   * Send to elasticsearch the document id to delete
   *
   * @param {Request} request
   * @returns {Promise} resolve an object that contains _id
   */
  this.delete = function elasticsearchDelete (request) {
    var esRequest = getElasticsearchRequest(request, kuzzle);

    if (esRequest.hasOwnProperty('refresh')) {
      if (this.esVersion && compareVersions(this.esVersion.number, '5.0.0') < 0) {
        return Promise.reject(new BadRequestError(`Refresh parameter is not supported by the version "${this.esVersion.number}" of Elasticsearch`));
      }
      if (compareVersions(config.apiVersion, '5.0') < 0) {
        return Promise.reject(new BadRequestError(`Refresh parameter is not supported by the version "${config.apiVersion}" of Elasticsearch API`));
      }
      if (esRequest.refresh !== 'wait_for' && esRequest.refresh !== 'false' && esRequest.refresh !== false) {
        return Promise.reject(new BadRequestError('Refresh parameter only supports the value "wait_for" or false'));
      }
    }

    // todo do not delete the document but pass active to false
    return this.client.delete(esRequest)
      .then(result => refreshIndexIfNeeded.call(this, esRequest, result))
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Delete all document that match the given filter
   *
   * @param {Request} request
   * @returns {Promise} resolve an object with ids
   */
  this.deleteByQuery = function elasticsearchDeleteByQuery (request) {
    var
      esRequest = getElasticsearchRequest(request, kuzzle),
      bodyBulk = [];

    esRequest.scroll = '30s';

    if (!esRequest.body.query || !(esRequest.body.query instanceof Object)) {
      return Promise.reject(new BadRequestError('Query cannot be empty'));
    }

    return getAllIdsFromQuery.call(this, esRequest)
      .then(ids => {
        ids.forEach(id => {
          bodyBulk.push({update: {_index: esRequest.index, _type: esRequest.type, _id: id}});
          bodyBulk.push({doc: {_kuzzle_info: { active: false, deletedAt: Date.now() }}});
        });

        if (bodyBulk.length === 0) {
          return Promise.resolve({ids: []});
        }

        return this.client.bulk({body: bodyBulk})
          .then(() => refreshIndexIfNeeded.call(this, esRequest, {ids: ids}))
          .catch(error => Promise.reject(this.formatESError(error)));
      });
  };

  /**
   * Delete all document that match the given filter from the trash
   * @param requestObject
   */
  this.deleteByQueryFromTrash = function elasticsearchDeleteByQueryFromTrash (requestObject) {
    var
      esRequest = getElasticsearchRequest(requestObject, kuzzle),
      bodyBulk = [];

    if (esRequest.body.query === null) {
      return Promise.reject(new BadRequestError('null is not a valid document ID'));
    }

    esRequest.scroll = '30s';
    return getPaginatedIdsFromQuery.call(this, esRequest)
      .then(ids => {
        return new Promise((resolve, reject) => {
          ids.forEach(id => {
            bodyBulk.push({delete: {_index: esRequest.index, _type: esRequest.type, _id: id}});
          });

          if (bodyBulk.length === 0) {
            return resolve({ids: []});
          }
          return this.client.bulk({body: bodyBulk})
            .then(() => refreshIndexIfNeeded.call(this, esRequest, {ids: ids}))
            .catch(error => reject(this.formatESError(error)));
        });
      });
  };

  /**
   * Create an empty collection with no mapping
   *
   * @param {Request} request
   * @returns {Promise}
   */
  this.createCollection = function elasticsearchCreateCollection (request) {
    var esRequest = getElasticsearchRequest(request, kuzzle);

    esRequest.body = {};
    esRequest.body[esRequest.type] = {};

    return this.client.indices.putMapping(esRequest)
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Empty the content of a collection. Keep the existing mapping.
   *
   * @param {Request} request
   * @returns {Promise}
   */
  this.truncateCollection = function elasticsearchTruncateCollection (request) {
    var
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
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Run several action and document
   *
   * @param {Request} request
   * @returns {Promise}
   */
  this.import = function elasticsearchImport (request) {
    var
      nameActions = ['index', 'create', 'update', 'delete'],
      optionalAttributes = ['consistency', 'refresh', 'routing', 'timeout', 'fields'],
      esRequest = getElasticsearchRequest(request, kuzzle),
      bulkData,
      error = null;

    if (esRequest.hasOwnProperty('refresh')) {
      if (this.esVersion && compareVersions(this.esVersion.number, '5.0.0') < 0) {
        return Promise.reject(new BadRequestError(`Refresh parameter is not supported by the version "${this.esVersion.number}" of Elasticsearch`));
      }
      if (compareVersions(config.apiVersion, '5.0') < 0) {
        return Promise.reject(new BadRequestError(`Refresh parameter is not supported by the version "${config.apiVersion}" of Elasticsearch API`));
      }
      if (esRequest.refresh !== 'wait_for' && esRequest.refresh !== 'false' && esRequest.refresh !== false) {
        return Promise.reject(new BadRequestError('Refresh parameter only supports the value "wait_for" or false'));
      }
    }

    if (!(esRequest.body.bulkData instanceof Object)) {
      return Promise.reject(new BadRequestError('import must specify a body attribute "bulkData" of type Object.'));
    }

    bulkData = {
      body: esRequest.body.bulkData
    };

    optionalAttributes.forEach(attr => {
      if (esRequest[attr] !== undefined) {
        bulkData[attr] = esRequest[attr];
      }
    });

    // set missing index & type if possible
    bulkData.body.forEach(item => {
      var action = Object.keys(item)[0];
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

        if (item[action]._index === kuzzle.internalEngine.index) {
          error = new BadRequestError(`Index "${kuzzle.internalEngine.index}" is protected, please use appropriated routes instead`);
          return false;
        }
      }
    });

    if (error) {
      return Promise.reject(error);
    }

    return this.client.bulk(bulkData)
      .then(response => refreshIndexIfNeeded.call(this, esRequest, response))
      .then(result => {
        // If some errors occured during the Bulk, we send a "Partial Error" response :
        if (result.errors) {
          result.partialErrors = [];

          Object.keys(result.items).forEach(resultItem => {
            Object.keys(result.items[resultItem]).forEach(action => {
              var item = result.items[resultItem][action];
              if (item.error) {
                item.action = action;
                result.partialErrors.push(item);
              }
            });
          });
        }

        return result;
      })
      .catch(err => Promise.reject(this.formatESError(err)));
  };

  /**
   * Add a mapping definition to a specific type
   *
   * @param {Request} request
   * @return {Promise}
   */
  this.updateMapping = function elasticsearchUpdateMapping (request) {
    var esEequest = getElasticsearchRequest(request, kuzzle);

    return this.client.indices.putMapping(esEequest)
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Retrieve mapping definition for index/type
   *
   * @param {Request} request
   * @return {Promise}
   */
  this.getMapping = function elasticsearchGetMapping (request) {
    var esRequest = getElasticsearchRequest(request, kuzzle);

    delete esRequest.body;

    return this.client.indices.getMapping(esRequest)
      .then(result => {
        if (result[request.input.resource.index]) {
          if (result[request.input.resource.index].mappings[request.input.resource.collection].properties) {
            delete result[request.input.resource.index].mappings[request.input.resource.collection].properties._kuzzle_info;
          }

          return result;
        }

        return Promise.reject(new NotFoundError('No mapping for index "' + request.input.resource.index + '"'));
      })
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Retrieve the complete list of existing data collections in the current index
   *
   * @param {Request} request
   * @return {Promise}
   */
  this.listCollections = function elasticsearchListCollections (request) {
    var esRequest = getElasticsearchRequest(request, kuzzle);

    delete esRequest.body;

    return this.client.indices.getMapping(esRequest)
      .then(result => {
        var collections = [];

        if (result[request.input.resource.index]) {
          collections = Object.keys(result[request.input.resource.index].mappings);
        }

        return {collections: {stored: collections}};
      })
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Reset all indexes that the users is allowed to delete
   *
   * @param {Request} request
   * @return {Promise}
   */
  this.deleteIndexes = function elasticsearchDeleteIndexes (request) {
    var deletedIndexes = request.input.body.indexes;

    request.input.body = null;

    if (deletedIndexes === undefined || deletedIndexes.length === 0) {
      return Promise.resolve({deleted: []});
    }

    return this.client.indices.delete({index: deletedIndexes})
      .then(() => ({deleted: deletedIndexes}))
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * List all known indexes
   *
   * @returns {Promise}
   */
  this.listIndexes = function elasticsearchListIndexes () {
    var indexes = [];

    return this.client.indices.getMapping()
      .then(result => {
        indexes = Object.keys(result);
        indexes = indexes.filter(indexName => {
          // @todo : manage internal index properly
          // exclude empty results
          return indexName !== '';
        });

        return {indexes};
      })
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Create a new index
   *
   * @param {Request} request
   * @returns {Promise}
   */
  this.createIndex = function elasticsearchCreateIndex (request) {
    var esRequest = getElasticsearchRequest(request, kuzzle);

    return this.client.indices.create({index: esRequest.index})
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Delete an index
   *
   * @param {Request} request
   * @returns {Promise}
   */
  this.deleteIndex = function elasticsearchDeleteIndex (request) {
    var esRequest = getElasticsearchRequest(request, kuzzle);

    delete this.settings.autoRefresh[esRequest.index];
    return this.client.indices.delete({index: esRequest.index})
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Forces a refresh on the index.
   *
   * /!\ Can lead to some performance issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html for more details
   *
   * @param {Request} request
   * @returns {Promise}
   */
  this.refreshIndex = function elasticsearchRefreshIndex (request) {
    var esRequest = getElasticsearchRequest(request, kuzzle);

    return this.client.indices.refresh({index: esRequest.index})
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * @param {Request} request
   * @returns {Promise}
   */
  this.indexExists = function esIndexExists (request) {
    var esRequest = getElasticsearchRequest(request, kuzzle);

    return this.client.indices.exists(esRequest)
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * @param {Request} request
   * @returns {Promise}
   */
  this.collectionExists = function esCollectionExists (request) {
    var esRequest = getElasticsearchRequest(request, kuzzle);

    return this.client.indices.existsType(esRequest)
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * gets the autorefresh value currently set for the given index
   *
   * @param {Request} request
   * @returns {Promise}
   */
  this.getAutoRefresh = function elasticsearchGetAutoRefresh (request) {
    return Promise.resolve(this.settings.autoRefresh[request.input.resource.index] === true);
  };

  /**
   * (dis|en)able the autorefresh for the index given in the request.
   *
   * @param {Request} request
   * @returns {Promise}
   */
  this.setAutoRefresh = function elasticsearchSetAutoRefresh (request) {
    var index = request.input.resource.index;

    if (request.input.body.autoRefresh === true) {
      this.settings.autoRefresh[index] = true;
    }
    else {
      delete this.settings.autoRefresh[index];
    }

    return this.saveSettings()
      .then(() => this.getAutoRefresh(request));
  };

  this.formatESError = function elasticsearchFormatESError (error) {
    var
      kuzzleError,
      messageReplaced,
      message = error.message || '';

    messageReplaced = this.errorMessagesMapping.some(mapping => {
      message = message.replace(mapping.regex, mapping.replacement);
      return (message !== error.message);
    });

    if (error instanceof KuzzleError) {
      return error;
    }

    if (error instanceof es.errors.NoConnections) {
      return new ServiceUnavailableError('Elasticsearch service is not connected');
    }

    switch (error.displayName) {
      case 'BadRequest':
        if (!messageReplaced) {
          message = error.body.error.root_cause ? error.body.error.root_cause[0].reason : error.body.error.reason;

          this.kuzzle.pluginsManager.trigger('log:warn', '[warning] unhandled elasticsearch error:\n' + error.message);
        }

        kuzzleError = new BadRequestError(message);
        break;
      case 'NotFound':
        if (!messageReplaced) {
          message = error.body.error
            ? error.body.error.reason + ': ' + error.body.error['resource.id']
            : error.message + ': ' + error.body._id;

          this.kuzzle.pluginsManager.trigger('log:warn', '[warning] unhandled elasticsearch error:\n' + error.message);
        }

        kuzzleError = new NotFoundError(message);
        break;
      default:
        kuzzleError = new Error(message);

        this.kuzzle.pluginsManager.trigger('log:warn', '[warning] unhandled elasticsearch error:\n' + error.message);
        break;
    }

    kuzzleError.internalError = error;
    kuzzleError.service = 'elasticsearch';

    return kuzzleError;
  };
}

util.inherits(ElasticSearch, Service);

module.exports = ElasticSearch;

/**
 * Builds a resquest formatted for Elasticsearch service
 * and map the name 'collection' to 'type' for ES
 *
 * @param {Request} request
 * @param {Kuzzle} kuzzle
 * @return {object} data the data with cleaned attributes
 */
function getElasticsearchRequest(request, kuzzle) {
  var data = {};

  if (request.input.resource.index) {
    if (request.input.resource.index === kuzzle.internalEngine.index) {
      throw new BadRequestError(`Cannot operate on Kuzzle internal index "${kuzzle.internalEngine.index}"`);
    }
    data.index = request.input.resource.index;
  }

  if (request.input.resource.collection) {
    data.type = request.input.resource.collection;
  }

  if (request.input.resource._id) {
    data.id = request.input.resource._id;
  }

  ['from', 'size', 'scroll', 'scrollId', 'refresh'].forEach(argumentName => {
    if (typeof request.input.args[argumentName] !== 'undefined') {
      data[argumentName] = request.input.args[argumentName];
    }
  });

  if (request.input.body) {
    data.body = request.input.body;
  }

  return data;
}

/**
 * Scroll index in elasticsearch and return all document ids that match the filter
 *
 * @this ElasticSearch
 * @param {object} esRequest
 * @returns {Promise} resolve an array
 */
function getAllIdsFromQuery(esRequest) {
  var ids = [];

  return new Promise((resolve, reject) => {
    this.client.search(esRequest, function getMoreUntilDone(error, response) {
      if (error) {
        return reject(error);
      }

      response.hits.hits.forEach(hit => {
        ids.push(hit._id);
      });

      if (response.hits.total !== ids.length) {
        this.client.scroll({
          scrollId: response._scroll_id,
          scroll: esRequest.scroll
        }, getMoreUntilDone.bind(this));
      }
      else {
        resolve(ids);
      }
    }.bind(this));
  });
}

/**
 * Scroll index in elasticsearch and return all document ids that match the filter
 *
 * @this ElasticSearch
 * @param {Object} data
 * @returns {Promise} resolve an array
 */
function getPaginatedIdsFromQuery(data) {
  var
    ids = [];

  return new Promise((resolve, reject) => {

    this.client.search(data, function getMoreUntilDone(error, response) {
      if (error) {
        return reject(error);
      }

      response.hits.hits.forEach(hit => {
        ids.push(hit._id);
      });

      // todo: use real scroll here
      resolve(ids);
    });
  });
}

/**
 * Add filter to get only the active documents
 * @param {object} esRequest
 */
function addActiveFilter(esRequest) {
  var
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
 * Triggers an refresh call on the index set in the data request if the autoRefresh is on.
 * Else, passes the response through.
 *
 * @this ElasticSearch
 * @param {object} esRequest
 * @param {object} response The response from elasticsearch
 * @returns {Promise}
 */
function refreshIndexIfNeeded(esRequest, response) {
  if (esRequest && esRequest.index && this.settings.autoRefresh[esRequest.index]) {
    return this.refreshIndex(new Request({index: esRequest.index}))
      .then(() => response)
      .catch(error => {
        // index refresh failures are non-blocking
        this.kuzzle.pluginsManager.trigger('log:error', new InternalError('Error refreshing index ' + esRequest.index + ':\n' + error.message));

        return Promise.resolve(response);
      });
  }

  return Promise.resolve(response);
}

/**
 * Remove depth in object (replace hits.hits<array>, with hits<array>)
 * Move _kuzzle_info from the document body to the root
 *
 * @param result
 * @returns {object}
 */
function flattenSearchResults(result) {
  if (result.hits) {
    result = _.extend(result, result.hits);
  }

  result.hits = result.hits.map(obj => {
    if (obj._source && obj._source._kuzzle_info) {
      // Move _kuzzle_info from the document body to the root
      obj._kuzzle_info = obj._source._kuzzle_info;
      delete obj._source._kuzzle_info;
    }

    return obj;
  });

  return result;
}

/**
 * Returns a new elasticsearch client instance
 *
 * @param {object} options - ES client options
 * @returns {object}
 */
function buildClient(config) {
  return new es.Client({
    hosts: config.hosts || config.host + ':' + config.port,
    apiVersion: config.apiVersion
  });
}
