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
        deferred.resolve(new ResponseObject(requestObject, result));
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  };

  /**
   * Count how many documents match the filter give in body
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
    var data = cleanData.call(this, requestObject);

    return this.client.create(data);
  };

  /**
   * Create a new document to ElasticSearch, or update it if it already exist
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object that contains _id
   */
  this.createOrUpdate = function (requestObject) {
    var data = cleanData.call(this, requestObject);

    return this.client.index(data);
  };

  /**
   * Send to elasticsearch the partial document
   * with the id to update
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object that contains _id
   */
  this.update = function (requestObject) {
    var data = cleanData.call(this, requestObject);
    data.body = {doc: data.body};

    return this.client.update(data);
  };

  /**
   * Send to elasticsearch the document id to delete
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object that contains _id
   */
  this.delete = function (requestObject) {
    var data = cleanData.call(this, requestObject);

    return this.client.delete(data);
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
      .then(function (ids) {
        async.each(ids, function (id, callback) {
          bodyBulk.push({delete: {_index: data.index, _type: data.type, _id: id}});
          callback();
        }, function () {

          if (bodyBulk.length === 0) {
            deferred.resolve({ids : []});
            return false;
          }

          this.client.bulk({body: bodyBulk})
            .then(function () {
              deferred.resolve({ids: ids});
            })
            .catch(function (error) {
              deferred.reject(error);
            });

        }.bind(this));
      }.bind(this))
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  };

  /**
   * Delete type definition and all data for the type
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object with the deleted collection name
   */
  this.deleteCollection = function (requestObject) {
    var
      deferred = q.defer(),
      data = cleanData.call(this, requestObject);

    this.client.indices.deleteMapping(data)
      .then(function () {
        deferred.resolve(new ResponseObject(requestObject));
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  };

  /**
   * Create an empty collection with no mapping
   *
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.createCollection = function (requestObject) {
    var data = cleanData.call(this, requestObject);

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
      deferred = q.defer(),
      mappings,
      data = cleanData.call(this, requestObject);

    delete data.body;

    this.client.indices.getMapping(data)
      .then(mapping => {
        if (!mapping[this.kuzzleConfig[this.engineType].index]) {
          return Promise.reject(new NotFoundError('The collection "' + data.type + '" does not exist'));
        }

        mappings = mapping[this.kuzzleConfig[this.engineType].index].mappings[data.type];
        return this.client.indices.deleteMapping(data);
      })
      .then(() => {
        data.body = {};
        data.body[data.type] = mappings;

        return this.client.indices.putMapping(data);
      })
      .then(result => deferred.resolve(new ResponseObject(requestObject, result)))
      .catch(error => deferred.reject(error));

    return deferred.promise;
  };

  /**
   * Run several action and document
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.import = function (requestObject) {
    var
      deferred = q.defer(),
      nameActions = ['index', 'create', 'update', 'delete'],
      data = cleanData.call(this, requestObject);

    if (data.body) {
      // override index
      async.eachLimit(data.body, 20, function (item) {
        var action = Object.keys(item)[0];
        if (nameActions.indexOf(action) !== -1) {
          if (data.type && data.type.length > 0) {
            item[action]._type = data.type;
          }
          else if (!item[action]._type) {
            return Promise.reject(new BadRequestError('Missing data collection argument'));
          }

          // TODO: implement multi index
          item[action]._index = this.kuzzleConfig[this.engineType].index;
        }
      }.bind(this));
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
            responseObject.error = new PartialError('Some error on bulk', stack);
            responseObject.status = responseObject.error.status;
          }
          deferred.resolve(responseObject);
        })
        .catch(function (error) {
          deferred.reject(error);
        });
      return deferred.promise;
    }

    return Promise.reject(new BadRequestError('Bulk import: Parse error: document <body> is missing'));
  };

  /**
   * Add a mapping definition for a specific type
   *
   * @param {RequestObject} requestObject
   * @return {Promise}
   */
  this.putMapping = function (requestObject) {
    var data = cleanData.call(this, requestObject);

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
      deferred = q.defer(),
      data = cleanData.call(this, requestObject);

    delete data.body;

    this.client.indices.getMapping(data)
      .then(function (result) {
        if (result[this.kuzzleConfig[this.engineType].index]) {
          deferred.resolve(new ResponseObject(requestObject, result));
        }
        else {
          deferred.reject(new NotFoundError('No mapping for current index'));
        }
      }.bind(this))
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  };

  /**
   * Retrieve the complete list of existing data collections in the current index
   *
   * @param {RequestObject} requestObject
   * @return {Promise}
   */
  this.listCollections = function (requestObject) {
    var
      deferred = q.defer(),
      data = cleanData.call(this, requestObject);

    delete data.body;

    this.client.indices.getMapping(data)
      .then(result => {
        var collections = [];

        if (result[this.kuzzleConfig[this.engineType].index]) {
          collections = Object.keys(result[this.kuzzleConfig[this.engineType].index].mappings);
        }

        deferred.resolve(new ResponseObject(requestObject, {collections: collections}));
      })
      .catch(error => deferred.reject(error));

    return deferred.promise;
  };

  /**
   * Reset the datastorage
   *
   * @return {Promise}
   */
  this.reset = function () {
    var
      deferred = q.defer();

    this.client.indices.delete({index: '_all'})
      .then(function () {
        this.client.indices.create({index: 'mainindex'})
          .then(function () {
            deferred.resolve(true);
          })
          .catch(function (error) {
            deferred.reject(error);
          });
      }.bind(this))
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  };
};

/**
 * Clean requestObject data: remove all attributes created for kuzzle,
 * add index if not defined and map the name 'collection' to 'type' for ES
 * @param {RequestObject} requestObject
 * @return {Object} data the data with cleaned attributes
 */
function cleanData(requestObject) {
  var data = {};

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

  // TODO: implement multi index
  data.index = this.kuzzleConfig[this.engineType].index;

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
        scroll: '30s'
      }, getMoreUntilDone.bind(this));
    }
    else {
      deferred.resolve(ids);
    }
    /* jshint camelcase: true */
  }.bind(this));

  return deferred.promise;
}
