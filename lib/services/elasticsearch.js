var
  _ = require('lodash'),
  Promise = require('bluebird'),
  async = require('async'),
  util = require('util'),
  Service = require('./service'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  NotFoundError = require('kuzzle-common-objects').Errors.notFoundError,
  es = require('elasticsearch');

/**
 * @property {Kuzzle} kuzzle
 * @property {Object} settings
 * @property {Object} client
 * @param {Kuzzle} kuzzle kuzzle instance
 * @param {Object} options used to start the service
 * @param {Object} config used to start the service
 * @constructor
 */
function ElasticSearch(kuzzle, options, config) {

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
    }
  });

  this.errorMessagesMapping = [
    {
      // [illegal_argument_exception] object mapping [titi] can't be changed from nested to non-nested
      regex: /^\[illegal_argument_exception\] object mapping \[(.*?)\] can't be changed from nested to non-nested$/,
      replacement: 'Can not change mapping for field "$1" from nested to another type'
    },
    {
      // [illegal_argument_exception] object mapping [baz] can't be changed from non-nested to nested
      regex: /^\[illegal_argument_exception\] object mapping \[(.*?)\] can\'t be changed from non-nested to nested$/,
      replacement: 'Can not change mapping for field "$1" from object to another type'
    },
    {
      // [illegal_argument_exception] Can't merge a non object mapping [aeaze] with an object mapping [aeaze]
      regex: /^\[illegal_argument_exception\] Can\'t merge a non object mapping \[(.*?)\] with an object mapping \[(.*?)\]$/,
      replacement: 'Can not change mapping for field "$1" from object to a scalar type'
    },
    {
      // [illegal_argument_exception] [tutu.tutu] is defined as an object in mapping [aze] but this name is already used for a field in other types
      regex: /^\[illegal_argument_exception\] \[(.*?)\] is defined as an object in mapping \[(.*?)\] but this name is already used for a field in other types$/,
      replacement: 'Can not set mapping for field "$1" on collection "$2" because the field name is already used in another collection with a different type'
    },
    {
      // [illegal_argument_exception] mapper [source.flags] of different type, current_type [string], merged_type [long]
      regex: /^\[illegal_argument_exception\] mapper \[(.*?)\] of different type, current_type \[(.*?)\], merged_type \[(.*?)\]$/,
      replacement: 'Can not change type of field "$1" from "$2" to "$3"'
    },
    {
      // [mapper_parsing_exception] Mapping definition for [flags] has unsupported parameters:  [index : not_analyzed]
      // eslint-disable-next-line no-regex-spaces
      regex: /^\[mapper_parsing_exception\] Mapping definition for \[(.*?)\] has unsupported parameters:  \[(.*?)\]$/,
      replacement: 'Parameter "$2" is not supported for field "$1"'
    },
    {
      // [mapper_parsing_exception] No handler for type [booleasn] declared on field [not]
      regex: /^\[mapper_parsing_exception\] No handler for type \[(.*?)\] declared on field \[(.*?)\]$/,
      replacement: 'Can not set mapping for field "$2" because type "$1" does not exist'
    },
    {
      // [mapper_parsing_exception] failed to parse [conditions.host.flags]
      regex: /^\[mapper_parsing_exception\] failed to parse \[(.*?)\]$/,
      replacement: 'Failed to validate value of field "$1". Are you trying to insert nested value in a non-nested field ?'
    },
    {
      // [index_not_found_exception] no such index, with { resource.type=index_or_alias resource.id=foso index=foso }
      regex: /^\[index_not_found_exception\] no such index, with { resource\.type=([^\s]+) resource\.id=([^\s]+) index=([^\s]+) }$/,
      replacement: 'Index "$2" does not exist, please create it first'
    },
    {
      // [mapper_parsing_exception] Expected map for property [fields] on field [foo] but got a class java.lang.String
      regex: /^\[mapper_parsing_exception\] Expected map for property \[fields\] on field \[(.*?)\] but got a class java\.lang\.String$/,
      replacement: 'Mapping for field "$1" must be an object with a property "type"'
    },
  ];

  /**
   * Initialize the elasticsearch client
   *
   * @returns {Promise}
   */
  this.init = function elasticsearchInit () {
    var host = config.host + ':' + config.port;

    if (this.client) {
      return Promise.resolve(this);
    }

    this.client = new es.Client({
      host,
      apiVersion: config.apiVersion
    });

    return Promise.resolve(this);
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
   * Search documents from elasticsearch with a query
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve documents matching the filter
   */
  this.search = function elasticsearchSearch (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    // todo add condition once the 'trash' feature has been implemented
    addActiveFilter(data);
    return this.client.search(data)
      .then(result => {
        // remove depth in object (replace hits.hits<array>, with hits<array>)
        if (result.hits) {
          result = _.extend(result, result.hits);
        }

        result.hits = result.hits.map(o => {
          if (o._source._kuzzle_info) {
            // Move _kuzzle_info from the document body to the root
            o._kuzzle_info = o._source._kuzzle_info;
            delete o._source._kuzzle_info;
          }

          return o;
        });

        return result;
      })
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Get the document with given ID
   * @param {RequestObject} requestObject contains id
   * @returns {Promise} resolve the document
   */
  this.get = function elasticsearchGet (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    delete data.body;

    // Just in case the user make a GET on url /mainindex/test/_search
    // Without this test we return something weird: a result.hits.hits with all document without filter because the body is empty in REST by default
    if (data.id === '_search') {
      return Promise.reject(new BadRequestError('The action _search can\'t be done with a GET'));
    }

    return this.client.get(data)
      .then(result => {
        if (result._source._kuzzle_info && !result._source._kuzzle_info.active) {
          // todo Feedback how to get it from the 'trash' once it is implemented
          return Promise.reject(new NotFoundError('Document ' + result._id + ' has been deleted'));
        }
        if (result._source._kuzzle_info) {
          result._kuzzle_info = result._source._kuzzle_info;
          delete result._source._kuzzle_info;
        }

        return result;
      })
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Return the list of documents matching the ids given in the body param
   * NB: Due to internal Kuzzle mechanism, can only be called on a single index/collection,
   * using the body { ids: [.. } syntax.
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.mget = function elasticsearchMget (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    return this.client.mget(data)
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
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve the number of document
   */
  this.count = function elasticsearchCount (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    /*
     ElasticSearch DSL is supposed to accept a 'query' object in the main part of the message.
     Problem is: the 'count' action only accepts a 'body' object, and any query passed to it is ignored.

     So, in order to suppress this discrepancy, if a count action is called without a body but with a query,
     we embed the query object in a body one.
     */
    if (!data.body || Object.keys(data.body).length === 0) {
      if (data.query && Object.keys(data.query).length > 0) {
        data.body = {query: data.query};
        delete data.query;
      } else {
        delete data.body;
      }
    }

    // todo add condition once the 'trash' feature has been implemented
    addActiveFilter(data);
    return this.client.count(data)
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Send to elasticsearch the new document
   * Clean data for match the elasticsearch specification
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object that contains _id
   */
  this.create = function elasticsearchCreate (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    if (data.body._routing) {
      Promise.reject(new BadRequestError('Kuzzle does not support "_routing" in create action.'));
    }

    // Add metadata
    data.body._kuzzle_info = {
      author: requestObject.userId ? String(requestObject.userId) : null,
      createdAt: Date.now(),
      updatedAt: null,
      updater: null,
      active: true
    };

    // Check if the document exists and has not been deleted (active: false)
    if (data.id) {
      return this.client.get({
        index: data.index,
        type: data.type,
        id: data.id
      })
        .then(result => {
          if (result._source._kuzzle_info && !result._source._kuzzle_info.active) {
            // Replace the document if it is inactive
            return this.client.index(data)
              .then(res => refreshIndexIfNeeded.call(this, data, _.extend(res, {_source: requestObject.data.body})))
              .catch(error => {
                return Promise.reject(this.formatESError(error));
              });
          }
          // Go into the catch without error to create the new document
          return Promise.reject();
        })
        .catch((err) => {
          if (err && err.displayName !== 'NotFound') {
            return Promise.reject(err);
          }
          // The document doesn't exist, we create it
          return this.client.create(data)
            .then(result => refreshIndexIfNeeded.call(this, data, _.extend(result, {_source: requestObject.data.body})))
            .catch(error => {
              return Promise.reject(this.formatESError(error));
            });
        });
    }
    return this.client.create(data)
      .then(result => refreshIndexIfNeeded.call(this, data, _.extend(result, {_source: requestObject.data.body})))
      .catch(error => {
        return Promise.reject(this.formatESError(error));
      });
  };

  /**
   * Create a new document to ElasticSearch, or replace it if it already exist
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object that contains _id
   */
  this.createOrReplace = function elasticsearchCreateOrReplace (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    if (data.body._routing) {
      Promise.reject(new BadRequestError('Kuzzle does not support "_routing" in createOrReplace action.'));
    }

    // Add metadata
    data.body._kuzzle_info = {
      author: requestObject.userId ? String(requestObject.userId) : null,
      createdAt: Date.now(),
      updatedAt: null,
      updater: null,
      active: true
    };

    return this.client.index(data)
      .then(result => refreshIndexIfNeeded.call(this, data, _.extend(result, {_source: requestObject.data.body})))
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Send to elasticsearch the partial document
   * with the id to update
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object that contains _id
   */
  this.update = function elasticsearchUpdate (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    if (data.body._routing) {
      Promise.reject(new BadRequestError('Kuzzle does not support "_routing" in update action.'));
    }

    // Add metadata
    data.body._kuzzle_info = {
      updatedAt: Date.now(),
      updater: requestObject.userId ? String(requestObject.userId) : null
    };

    data.body = {doc: data.body};

    return this.client.update(data)
      .then(result => refreshIndexIfNeeded.call(this, data, result))
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Replace a document to ElasticSearch
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object that contains _id
   */
  this.replace = function elasticsearchReplace (requestObject) {
    var
      data = cleanData.call(this, requestObject),
      existQuery = {
        index: data.index,
        type: data.type,
        id: data.id
      };

    if (data.body._routing) {
      Promise.reject(new BadRequestError('Kuzzle does not support "_routing" in replace action.'));
    }

    // Add metadata
    data.body._kuzzle_info = {
      author: requestObject.userId ? String(requestObject.userId) : null,
      createdAt: Date.now(),
      updatedAt: null,
      updater: null,
      active: true
    };
    // extends the response with the source from requestObject
    // When we write in ES, the response from it doesn't contain the initial document content
    return this.client.exists(existQuery)
      .then((exists) => {
        if (exists) {
          return this.client.index(data);
        }

        return Promise.reject(new NotFoundError('Document with id ' + data.id + ' not found.'));
      })
      .then(result => refreshIndexIfNeeded.call(this, data, _.extend(result, {_source: requestObject.data.body})));
  };

  /**
   * Send to elasticsearch the document id to delete
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object that contains _id
   */
  this.delete = function elasticsearchDelete (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    // todo do not delete the document but pass active to false
    return this.client.delete(data)
      .then(result => refreshIndexIfNeeded.call(this, data, result))
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Delete all document that match the given filter
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object with ids
   */
  this.deleteByQuery = function elasticsearchDeleteByQuery (requestObject) {
    var
      data = cleanData.call(this, requestObject),
      bodyBulk = [];

    if (requestObject.data.body === null) {
      return Promise.reject(new BadRequestError('null is not a valid document ID'));
    }

    data.scroll = '30s';

    // todo do not delete the document but pass active to false
    return getAllIdsFromQuery.call(this, data)
      .then(ids => {
        return new Promise((resolve, reject) => {
          async.each(ids, (id, callback) => {
            bodyBulk.push({delete: {_index: data.index, _type: data.type, _id: id}});
            callback();
          }, () => {
            if (bodyBulk.length === 0) {
              return resolve({ids: []});
            }

            this.client.bulk({body: bodyBulk})
              .then(() => refreshIndexIfNeeded.call(this, data, {ids: ids}))
              .then(result => resolve(result))
              .catch(error => reject(this.formatESError(error)));
          });
        });
      });
  };

  /**
   * Create an empty collection with no mapping
   *
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.createCollection = function elasticsearchCreateCollection (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    data.body = {};
    data.body[data.type] = {};

    return this.client.indices.putMapping(data)
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Empty the content of a collection. Keep the existing mapping.
   *
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.truncateCollection = function elasticsearchTruncateCollection (requestObject) {
    var
      deleteRequestObject = new RequestObject({
        index: requestObject.index,
        collection: requestObject.collection,
        body: {}
      });

    return this.deleteByQuery(deleteRequestObject)
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Run several action and document
   *
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.import = function elasticsearchImport (requestObject) {
    var
      nameActions = ['index', 'create', 'update', 'delete'],
      optionalAttributes = ['consistency', 'refresh', 'routing', 'timeout', 'fields'],
      data = cleanData.call(this, requestObject),
      bulkData,
      error = null;

    if (!data.body) {
      return Promise.reject(new BadRequestError('Bulk import: Parse error: document <body> is missing'));
    }

    if (!data.body.bulkData) {
      return Promise.reject(new BadRequestError('Bulk import: Parse error: input paramter <bulkData> is missing'));
    }

    bulkData = {
      body: data.body.bulkData
    };
    optionalAttributes.forEach(attr => {
      if (data[attr] !== undefined) {
        bulkData[attr] = data[attr];
      }
    });

    // set missing index & type if possible
    bulkData.body.forEach(item => {
      var action = Object.keys(item)[0];
      if (nameActions.indexOf(action) !== -1) {
        if (!item[action]._type && data.type !== undefined) {
          item[action]._type = data.type;
        }
        if (!item[action]._type) {
          error = new BadRequestError('Missing data collection argument');
        }

        if (!item[action]._index && data.index !== undefined) {
          item[action]._index = data.index;
        }
        if (!item[action]._index) {
          error = new BadRequestError('Missing data collection argument');
          return false;
        }
      }
    });

    if (error) {
      return Promise.reject(error);
    }

    return this.client.bulk(bulkData)
      .then(response => refreshIndexIfNeeded.call(this, data, response))
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
   * @param {RequestObject} requestObject
   * @return {Promise}
   */
  this.updateMapping = function elasticsearchUpdateMapping (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    return this.client.indices.putMapping(data)
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Retrieve mapping definition for index/type
   *
   * @param {RequestObject} requestObject
   * @return {Promise}
   */
  this.getMapping = function elasticsearchGetMapping (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    delete data.body;

    return this.client.indices.getMapping(data)
      .then(result => {
        if (result[requestObject.index]) {
          if (result[requestObject.index].mappings[requestObject.collection].properties) {
            delete result[requestObject.index].mappings[requestObject.collection].properties._kuzzle_info;
          }

          return result;
        }

        return Promise.reject(new NotFoundError('No mapping for index "' + requestObject.index + '"'));
      })
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Retrieve the complete list of existing data collections in the current index
   *
   * @param {RequestObject} requestObject
   * @return {Promise}
   */
  this.listCollections = function elasticsearchListCollections (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    delete data.body;

    return this.client.indices.getMapping(data)
      .then(result => {
        var collections = [];

        if (result[requestObject.index]) {
          collections = Object.keys(result[requestObject.index].mappings);
        }

        return {collections: {stored: collections}};
      })
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Reset all indexes that the users is allowed to delete
   *
   * @return {Promise}
   */
  this.deleteIndexes = function elasticsearchDeleteIndexes (requestObject) {
    var deletedIndexes = requestObject.data.body.indexes;

    delete requestObject.data.body;

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
    var
      indexes = [];

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
   * @param {object} requestObject
   * @returns {Promise}
   */
  this.createIndex = function elasticsearchCreateIndex (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    return this.client.indices.create({index: data.index})
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Delete an index
   *
   * @param {object} requestObject
   * @returns {Promise}
   */
  this.deleteIndex = function elasticsearchDeleteIndex (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    delete this.settings.autoRefresh[data.index];
    return this.client.indices.delete({index: data.index})
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * Forces a refresh on the index.
   *
   * /!\ Can lead to some performance issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html for more details
   *
   * @param {object} requestObject
   * @returns {Promise}
   */
  this.refreshIndex = function elasticsearchRefreshIndex (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    return this.client.indices.refresh({index: data.index})
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  this.indexExists = function esIndexExists (requestObject) {
    var data = cleanData.call(this, requestObject);

    return this.client.indices.exists(data)
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  this.collectionExists = function esCollectionExists (requestobject) {
    var data = cleanData.call(this, requestobject);

    return this.client.indices.existsType(data)
      .catch(error => Promise.reject(this.formatESError(error)));
  };

  /**
   * gets the autorefresh value currently set for the given index
   *
   * @param {object} requestObject
   * @returns {Promise}
   */
  this.getAutoRefresh = function elasticsearchGetAutoRefresh (requestObject) {
    return Promise.resolve(this.settings.autoRefresh[requestObject.index] === true);
  };

  /**
   * (dis|en)able the autorefresh for the index given in the requestObject.
   *
   * @param {object} requestObject
   * @returns {Promise}
   */
  this.setAutoRefresh = function elasticsearchSetAutoRefresh (requestObject) {
    var index = requestObject.index;

    if (requestObject.data.body.autoRefresh === true) {
      this.settings.autoRefresh[index] = true;
    }
    else {
      delete this.settings.autoRefresh[index];
    }

    return this.saveSettings()
      .then(() => this.getAutoRefresh(requestObject));
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
 * Clean requestObject data: remove all attributes created for kuzzle,
 * add index and map the name 'collection' to 'type' for ES
 * @param {RequestObject} requestObject
 * @return {Object} data the data with cleaned attributes
 */
function cleanData(requestObject) {
  var data = {};

  if (requestObject.index !== undefined) {
    data.index = requestObject.index;
  }

  if (requestObject.collection !== undefined) {
    data.type = requestObject.collection;
  }

  if (requestObject.data._id) {
    data.id = requestObject.data._id;
  }

  Object.keys(requestObject.data).forEach(attr => {
    if (attr !== '_id') {
      data[attr] = requestObject.data[attr];
    }
  });

  if (data.body && data.body._id) {
    delete data.body._id;
  }

  return data;
}

/**
 * Scroll index in elasticsearch and return all document ids that match the filter
 *
 * @this ElasticSearch
 * @param {Object} data
 * @returns {Promise} resolve an array
 */
function getAllIdsFromQuery(data) {
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

      if (response.hits.total !== ids.length) {
        this.client.scroll({
          scrollId: response._scroll_id,
          scroll: data.scroll
        }, getMoreUntilDone.bind(this));
      }
      else {
        resolve(ids);
      }
    }.bind(this));
  });
}

/**
 * Add filter to get only the active documents
 * @param data
 */
function addActiveFilter(data) {
  var
    queryObject = {
      bool: {
        filter: [{bool: {should: [{term: {'_kuzzle_info.active': true}}, {missing: {'field': '_kuzzle_info'}}]}}]
      }
    };

  if (data.body && data.body.query) {
    queryObject.bool.must = data.body.query;
    data.body.query = queryObject;
  }
  else if (data.body) {
    data.body.query = queryObject;
  }
  else {
    data.body = {
      query: queryObject
    };
  }
}

/**
 * Triggers an refresh call on the index set in the data request if the autoRefresh is on.
 * Else, passes the response through.
 *
 * @this ElasticSearch
 * @param {Object} data       The data computed from the requestObject
 * @param {Object} response   The response from elasticsearch
 * @returns {Promise}
 */
function refreshIndexIfNeeded(data, response) {
  if (data && data.index && this.settings.autoRefresh[data.index]) {
    return this.refreshIndex(new RequestObject({index: data.index}))
      .then(() => response)
      .catch(error => {
        // index refresh failures are non-blocking
        this.kuzzle.pluginsManager.trigger('log:error', new InternalError('Error refreshing index ' + data.index + ':\n' + error.message));

        return Promise.resolve(response);
      });
  }

  return Promise.resolve(response);
}
