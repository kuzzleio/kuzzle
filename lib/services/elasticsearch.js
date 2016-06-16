var
  _ = require('lodash'),
  q = require('q'),
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
 * @constructor
 */
function ElasticSearch (kuzzle, options) {

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

  /**
   * Initialize the elasticsearch client
   *
   * @returns {Object} client
   */
  this.init = function () {
    if (this.client) {
      return this;
    }

    this.client = new es.Client({
      host: kuzzle.config[this.settings.service].hosts,
      apiVersion: kuzzle.config[this.settings.service].apiVersion
    });

    return q(this);
  };

  /**
   * Return some basic information about this service
   *
   * @returns {Promise} service informations
   */
  this.getInfos = function () {
    var response = {
      type: 'elasticsearch',
      api: kuzzle.config[this.settings.service].apiVersion
    };

    return this.client.info()
      .then(res => {
        /** @type {{version: {number: Number, lucene_version: String}}} res */
        response.version = res.version.number;
        /* jshint camelcase: false */
        response.lucene = res.version.lucene_version;
        /* jshint camelcase: true */

        return this.client.cluster.health();
      })
      .then(res => {
        /** @type {{status: String, number_of_nodes: Number}} res */
        response.status = res.status;
        /* jshint camelcase: false */
        response.nodes = res.number_of_nodes;
        /* jshint camelcase: true */
        return this.client.cluster.stats({human: true});
      })
      .then(res => {
        response.spaceUsed = res.indices.store.size;
        response.nodes = res.nodes;
        return response;
      });
  };

  /**
   * Search documents from elasticsearch with a query
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve documents matching the filter
   */
  this.search = function (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    return this.client.search(data)
      .then(result => {
        // remove depth in object (replace hits.hits<array>, with hits<array>)
        if (result.hits) {
          result = _.extend(result, result.hits);
        }

        return result;
      });
  };

  /**
   * Get the document with given ID
   * @param {RequestObject} requestObject contains id
   * @returns {Promise} resolve the document
   */
  this.get = function (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    delete data.body;

    // Just in case the user make a GET on url /mainindex/test/_search
    // Without this test we return something weird: a result.hits.hits with all document without filter because the body is empty in REST by default
    if (data.id === '_search') {
      return q.reject(new BadRequestError('The action _search can\'t be done with a GET'));
    }

    return this.client.get(data);
  };

  /**
   * Return the list of documents matching the ids given in the body param
   * NB: Due to internal Kuzzle mechanism, can only be called on a single index/collection,
   * using the body { ids: [.. } syntax.
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.mget = function (requestObject) {
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
      });
  };

  /**
   * Count how many documents match the filter given in body
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve the number of document
   */
  this.count = function (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    /*
      ElasticSearch DSL is supposed to accept a 'query' object in the main part of the message.
      Problem is: the 'count' action only accepts a 'body' object, and any query passed to it is ignored.

      So, in order to suppress this discrepancy, if a count action is called without a body but with a query,
      we embed the query object in a body one.
    */
    if (_.isEmpty(data.body)) {
      if (!_.isEmpty(data.query)) {
        data.body = { query: data.query };
        delete data.query;
      } else {
        delete data.body;
      }
    }

    return this.client.count(data);
  };

  /**
   * Send to elasticsearch the new document
   * Clean data for match the elasticsearch specification
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object that contains _id
   */
  this.create = function (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    // extends the response with the source from requestObject
    // When we write in ES, the response from it doesn't contain the initial document content
    return this.client.create(data)
      .then(result => refreshIndexIfNeeded.call(this, data, _.extend(result, {_source: requestObject.data.body})));
  };

  /**
   * Create a new document to ElasticSearch, or replace it if it already exist
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object that contains _id
   */
  this.createOrReplace = function (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    // extends the response with the source from requestObject
    // When we write in ES, the response from it doesn't contain the initial document content
    return this.client.index(data)
      .then(result => refreshIndexIfNeeded.call(this, data, _.extend(result, {_source: requestObject.data.body})));
  };

  /**
   * Send to elasticsearch the partial document
   * with the id to update
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object that contains _id
   */
  this.update = function (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    data.body = {doc: data.body};

    return this.client.update(data)
      .then(result => refreshIndexIfNeeded.call(this, data, result));
  };

  /**
   * Replace a document to ElasticSearch
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object that contains _id
   */
  this.replace = function (requestObject) {
    var
      data = cleanData.call(this, requestObject),
      existQuery = {
        index: data.index,
        type: data.type,
        id: data.id
      };

    // extends the response with the source from requestObject
    // When we write in ES, the response from it doesn't contain the initial document content
    return this.client.exists(existQuery)
      .then((exists) => {
        if (exists) {
          return this.client.index(data);
        }

        return q.reject(new NotFoundError('Document with id ' + data.id + ' not found.'));
      })
      .then(result => refreshIndexIfNeeded.call(this, data, _.extend(result, {_source: requestObject.data.body})));
  };

  /**
   * Send to elasticsearch the document id to delete
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object that contains _id
   */
  this.delete = function (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    return this.client.delete(data)
      .then(result => refreshIndexIfNeeded.call(this, data, result));
  };

  /**
   * Delete all document that match the given filter
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object with ids
   */
  this.deleteByQuery = function (requestObject) {
    var
      deferred = q.defer(),
      data = cleanData.call(this, requestObject),
      bodyBulk = [];

    if (requestObject.data.body === null) {
      return q.reject(new BadRequestError('null is not a valid document ID'));
    }

    data.scroll = '30s';

    getAllIdsFromQuery.call(this, data)
      .then(ids => {
        async.each(ids, (id, callback) => {
          bodyBulk.push({delete: {_index: data.index, _type: data.type, _id: id}});
          callback();
        }, () => {
          if (bodyBulk.length === 0) {
            deferred.resolve({ids : []});
            return false;
          }

          this.client.bulk({body: bodyBulk})
            .then(() => refreshIndexIfNeeded.call(this, data, {ids: ids}))
            .then(result => deferred.resolve(result))
            .catch(error => deferred.reject(error));
        });
      })
      .catch(error => deferred.reject(error));

    return deferred.promise;
  };

  /**
   * Create an empty collection with no mapping
   *
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.createCollection = function (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    data.body = {};
    data.body[data.type] = {};

    return this.client.indices.putMapping(data);
  };

  /**
   * Empty the content of a collection. Keep the existing mapping.
   *
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.truncateCollection = function (requestObject) {
    var
      deleteRequestObject = new RequestObject({
        index: requestObject.index,
        collection: requestObject.collection,
        body: { }
      });

    return this.deleteByQuery(deleteRequestObject);
  };

  /**
   * Run several action and document
   *
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.import = function (requestObject) {
    var
      deferred = q.defer(),
      nameActions = ['index', 'create', 'update', 'delete'],
      data = cleanData.call(this, requestObject);

    if (data.body) {
      // set missing index & type if possible
      async.eachLimit(data.body, 20, item => {
        var action = Object.keys(item)[0];
        if (nameActions.indexOf(action) !== -1) {
          if (!item[action]._type && data.type !== undefined) {
            item[action]._type = data.type;
          }
          if (!item[action]._type) {
            deferred.reject(new BadRequestError('Missing data collection argument'));
            return false;
          }

          if (!item[action]._index && data.index !== undefined) {
            item[action]._index = data.index;
          }
          if (!item[action]._index) {
            deferred.reject(new BadRequestError('Missing data collection argument'));
            return false;
          }
        }
      });

      if (!deferred.promise.isRejected()) {
        this.client.bulk(data)
          .then(response => refreshIndexIfNeeded.call(this, data, response))
          .then(function (result) {
            var
              stack;

            // If some errors occured during the Bulk, we send a "Partial Error" response :
            if (result.errors) {
              stack = [];
              async.each(result.items, function(resultItem, resultCallback) {
                async.each(Object.keys(resultItem), function(action, callback) {
                  var item = resultItem[action];
                  if (item.error) {
                    item.action = action;
                    stack.push(item);
                  }
                  callback();
                });
                resultCallback();
              });

              result.partialErrors = stack;
            }

            async.each(result.items, function(resultItem, resultCallback) {
              async.each(Object.keys(resultItem), function(action, callback) {
                callback();
              });
              resultCallback();
            });

            deferred.resolve(result);
          })
          .catch(function (error) {
            deferred.reject(error);
          });
      }

      return deferred.promise;
    }

    return q.reject(new BadRequestError('Bulk import: Parse error: document <body> is missing'));
  };

  /**
   * Add a mapping definition to a specific type
   *
   * @param {RequestObject} requestObject
   * @return {Promise}
   */
  this.updateMapping = function (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    return this.client.indices.putMapping(data);
  };

  /**
   * Retrieve mapping definition for index/type
   *
   * @param {RequestObject} requestObject
   * @return {Promise}
   */
  this.getMapping = function (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    delete data.body;

    return this.client.indices.getMapping(data)
      .then(result => {
        if (result[requestObject.index]) {
          return result;
        }

        return q.reject(new NotFoundError('No mapping for index "' + requestObject.index + '"'));
      });
  };

  /**
   * Retrieve the complete list of existing data collections in the current index
   *
   * @param {RequestObject} requestObject
   * @return {Promise}
   */
  this.listCollections = function (requestObject) {
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
      });
  };

  /**
   * Reset all indexes that the users is allowed to delete
   *
   * @return {Promise}
   */
  this.deleteIndexes = function (requestObject) {
    var deletedIndexes = requestObject.data.body.indexes;

    delete requestObject.data.body;

    if (deletedIndexes === undefined || deletedIndexes.length === 0) {
      return q({deleted: []});
    }

    return this.client.indices.delete({index: deletedIndexes})
      .then (() => ({deleted: deletedIndexes}));
  };

  /**
   * List all known indexes
   *
   * @returns {promise}
   */
  this.listIndexes = function () {
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

        return {indexes: indexes};
      });
  };

  /**
   * Create a new index
   *
   * @param {object} requestObject
   * @returns promise}
   */
  this.createIndex = function (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    return this.client.indices.create({index: data.index});
  };

  /**
   * Delete an index
   *
   * @param {object} requestObject
   * @returns {promise}
   */
  this.deleteIndex = function (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    delete this.settings.autoRefresh[data.index];
    return this.client.indices.delete({index: data.index});
  };

  /**
   * Forces a refresh on the index.
   *
   * /!\ Can lead to some performance issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html for more details
   *
   * @param {object} requestObject
   * @returns {promise}
   */
  this.refreshIndex = function (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    return this.client.indices.refresh({ index: data.index });
  };

  /**
   * gets the autorefresh value currently set for the given index
   *
   * @param {object} requestObject
   * @returns {*}
   */
  this.getAutoRefresh = function (requestObject) {
    return q(this.settings.autoRefresh[requestObject.index] === true);
  };

  /**
   * (dis|en)able the autorefresh for the index given in the requestObject.
   *
   * @param {object} requestObject
   * @returns {*}
   */
  this.setAutoRefresh = function (requestObject) {
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

  Object.keys(requestObject.data).forEach(function (attr) {
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
    deferred = q.defer(),
    ids = [];

  this.client.search(data, function getMoreUntilDone (error, response) {
    if (error) {
      deferred.reject(error);
      return false;
    }

    response.hits.hits.forEach(function (hit) {
      ids.push(hit._id);
    });

    /* jshint camelcase: false */
    if (response.hits.total !== ids.length) {
      this.client.scroll({
        scrollId: response._scroll_id,
        scroll: data.scroll
      }, getMoreUntilDone.bind(this));
    }
    else {
      deferred.resolve(ids);
    }
    /* jshint camelcase: true */
  }.bind(this));

  return deferred.promise;
}

/**
 * Triggers an refresh call on the index set in the data request if the autoRefresh is on.
 * Else, passes the response through.
 *
 * @this ElasticSearch
 * @param {Object} data       The data computed from the requestObject
 * @param {Object} response   The response from elasticsearch
 * @returns {*}
 */
function refreshIndexIfNeeded(data, response) {
  var deferred;

  if (data && data.index && this.settings.autoRefresh[data.index]) {
    deferred = q.defer();

    this.refreshIndex(new RequestObject({ index: data.index }))
      .then(() => {
        deferred.resolve(response);
      })
      .catch(error => {
        // index refresh failures are non-blocking
        this.kuzzle.pluginsManager.trigger('log:error', new InternalError('Error refreshing index ' + data.index + ':\n' + error.message));

        deferred.resolve(response);
      });

    return deferred.promise;
  }

  return q(response);
}
