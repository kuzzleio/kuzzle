var
  _ = require('lodash'),
  q = require('q'),
  async = require('async'),
  ResponseObject = require('../api/core/models/responseObject'),
  BadRequestError = require('../api/core/errors/badRequestError'),
  NotFoundError = require('../api/core/errors/notFoundError'),
  PartialError = require('../api/core/errors/partialError'),
  es = require('elasticsearch');

/**
 *
 * @param {Object} kuzzle kuzzle instance
 * @param {Object} options used to start the service
 */
module.exports = function (kuzzle, options) {
  this.kuzzleConfig = kuzzle.config;
  this.client = null;
  this.engineType = options.service;

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
      host: this.kuzzleConfig[this.engineType].hosts,
      apiVersion: this.kuzzleConfig[this.engineType].apiVersion
    });

    return this;
  };

  /**
   * Return some basic information about this service
   *
   * @returns {Promise} service informations
   */
  this.getInfos = function () {
    var response = {
      type: 'elasticsearch',
      api: this.kuzzleConfig[this.engineType].apiVersion
    };

    return this.client.info()
      .then(res => {
        response.version = res.version.number;
        /* jshint camelcase: false */
        response.lucene = res.version.lucene_version;
        /* jshint camelcase: true */

        return this.client.cluster.health();
      })
      .then(res => {
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
      deferred = q.defer(),
      data = cleanData.call(this, requestObject);

    this.client.search(data)
      .then(function (result) {
        // remove depth in object (replace hits.hits<array>, with hits<array>)
        if (result.hits) {
          result = _.extend(result, result.hits);
        }

        deferred.resolve(new ResponseObject(requestObject, result));
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  };

  /**
   * Get the document with given ID
   * @param {RequestObject} requestObject contains id
   * @returns {Promise} resolve the document
   */
  this.get = function (requestObject) {
    var
      deferred = q.defer(),
      data = cleanData.call(this, requestObject);

    delete data.body;

    // Just in case the user make a GET on url /mainindex/test/_search
    // Without this test we return something weird: a result.hits.hits with all document without filter because the body is empty in REST by default
    if (data.id === '_search') {
      return q.reject(new BadRequestError('The action _search can\'t be done with a GET'));
    }

    this.client.get(data)
      .then(function (result) {
        deferred.resolve(new ResponseObject(requestObject, result));
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
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
      deferred = q.defer(),
      data = cleanData.call(this, requestObject);

    this.client.mget(data)
      .then(function (result) {

        // uniform with search
        if (result.docs) {
          result.hits = result.docs;
          delete result.docs;
        }

        deferred.resolve(new ResponseObject(requestObject, result));
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  };

  /**
   * Count how many documents match the filter given in body
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve the number of document
   */
  this.count = function (requestObject) {
    var
      deferred = q.defer(),
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
    this.client.count(data)
      .then(function (result) {
        deferred.resolve(new ResponseObject(requestObject, result));
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
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

    return this.client.create(data)
      .then(result => {
        // extends the response with the source from requestObject
        // When we write in ES, the response from it doesn't contain the initial document content
        result = _.extend(result, {_source: requestObject.data.body});
        return new ResponseObject(requestObject, result);
      });
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

    return this.client.index(data)
      .then(result => {
        // extends the response with the source from requestObject
        // When we write in ES, the response from it doesn't contain the initial document content
        result = _.extend(result, {_source: requestObject.data.body});
        return new ResponseObject(requestObject, result);
      });
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
      .then(result => {
        return new ResponseObject(requestObject, result);
      });
  };

  /**
   * Replace a document to ElasticSearch
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object that contains _id
   */
  this.replace = function (requestObject) {
    var
      deferred = q.defer(),
      data = cleanData.call(this, requestObject);

    this.client.exists({
      index: data.index,
      type: data.type,
      id: data.id
    })
      .then((exists) => {
        if (exists) {
          this.client.index(data)
            .then(function (result) {
              // extends the response with the source from requestObject
              // When we write in ES, the response from it doesn't contain the initial document content
              result = _.extend(result, {_source: requestObject.data.body});
              deferred.resolve(new ResponseObject(requestObject, result));
            })
            .catch(function (error) {
              deferred.reject(error);
            });
        } else {
          deferred.reject(new NotFoundError('Document with id ' + data.id + ' not found.'));
        }
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
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
      .then(result => {
        return new ResponseObject(requestObject, result);
      });
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

    data.scroll = '30s';

    getAllIdsFromQuery.call(this, data)
      .then(ids => {
        async.each(ids, (id, callback) => {
          bodyBulk.push({delete: {_index: data.index, _type: data.type, _id: id}});
          callback();
        }, () => {
          if (bodyBulk.length === 0) {
            deferred.resolve(new ResponseObject(requestObject, {ids : []}));
            return false;
          }

          this.client.bulk({body: bodyBulk})
            .then(() => deferred.resolve(new ResponseObject(requestObject, {ids : ids})))
            .catch(error => deferred.reject(error));
        });
      })
      .catch(error => deferred.reject(error));

    return deferred.promise;
  };

  /**
   * Delete type definition and all data for the type
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object with the deleted collection name
   */
  this.deleteCollection = function (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    return this.client.indices.deleteMapping(data)
      .then(() => {
        return new ResponseObject(requestObject);
      });
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

    return this.client.indices.putMapping(data)
      .then(() => {
        return new ResponseObject(requestObject);
      });
  };

  /**
   * Empty the content of a collection. Keep the existing mapping.
   *
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.truncateCollection = function (requestObject) {
    var
      mappings,
      data = cleanData.call(this, requestObject);

    delete data.body;

    return this.client.indices.getMapping(data)
      .then(mapping => {
        if (!mapping[data.index]) {
          return q.reject(new NotFoundError('The collection "' + data.type + '" in index "' + data.index + '" does not exist'));
        }

        mappings = mapping[data.index].mappings[data.type];
        return this.client.indices.deleteMapping(data);
      })
      .then(() => {
        data.body = {};
        data.body[data.type] = mappings;

        return this.client.indices.putMapping(data);
      })
      .then(result => {
        return new ResponseObject(requestObject, result);
      });
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
          .then(function (result) {
            var
              responseObject,
              stack;

            responseObject = new ResponseObject(requestObject, result);
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
              responseObject.error = new PartialError('Some errors on bulk', stack);
              responseObject.status = responseObject.error.status;
            }

            async.each(result.items, function(resultItem, resultCallback) {
              async.each(Object.keys(resultItem), function(action, callback) {
                callback();
              });
              resultCallback();
            });

            deferred.resolve(responseObject);
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
   * Add a mapping definition for a specific type
   *
   * @param {RequestObject} requestObject
   * @return {Promise}
   */
  this.updateMapping = function (requestObject) {
    var
      data = cleanData.call(this, requestObject);

    return this.client.indices.putMapping(data)
      .then(result => {
        return new ResponseObject(requestObject, result);
      });
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
          return new ResponseObject(requestObject, result);
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

        return new ResponseObject(requestObject, {collections: {stored: collections}});
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
      return q(new ResponseObject(requestObject, {deleted: []}));
    }

    return this.client.indices.delete({index: deletedIndexes})
      .then (() => {
        return new ResponseObject(requestObject, {deleted: deletedIndexes});
      });
  };

  /**
   * List all known indexes
   *
   * @param {object} requestObject
   * @returns {promise}
   */
  this.listIndexes = function (requestObject) {
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

        return new ResponseObject(requestObject, {indexes: indexes});
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

    return this.client.indices.create({index: data.index})
      .then(result => {
        return new ResponseObject(requestObject, result);
      });
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

    return this.client.indices.delete({index: data.index})
      .then(result => {
        return new ResponseObject(requestObject, result);
      });
  };
};

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

  return data;
}

/**
 * Scroll index in elasticsearch and return all document ids that match the filter
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
