var
  _ = require('lodash'),
  q = require('q'),
  async = require('async'),
  ResponseObject = require('../api/core/models/responseObject'),
  es = require('elasticsearch');

module.exports = {

  kuzzleConfig: null,
  client: null,
  engineType: '',

  /**
   * Initialize the elasticsearch client
   *
   * @param {Object} kuzzleConfig kuzzle configuration
   * @param {String} engineType 'writeEngine' or 'readEngine'
   * @returns {Object} client
   */
  init: function (kuzzleConfig, engineType) {
    if (this.client) {
      return this.client;
    }

    this.kuzzleConfig = kuzzleConfig;
    this.engineType = engineType;

    if (this.kuzzleConfig[this.engineType].host.indexOf(',') !== -1) {
      this.kuzzleConfig[this.engineType].host = this.kuzzleConfig[this.engineType].host.split(',');
    }

    this.client = new es.Client({
      host: this.kuzzleConfig[this.engineType].host,
      apiVersion: this.kuzzleConfig[this.engineType].apiVersion
    });

    return this.client;
  },

  /**
   * Search documents from elasticsearch with a query
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve documents matching the filter
   */
  search: function (requestObject) {
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
  },

  /**
   * Get the document with given ID
   * @param {RequestObject} requestObject contains id
   * @returns {Promise} resolve the document
   */
  get: function (requestObject) {
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
  },

  /**
   * Count how many documents match the filter give in body
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve the number of document
   */
  count: function (requestObject) {
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
  },

  /**
   * Send to elasticsearch the new document
   * Clean data for match the elasticsearch specification
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object that contains _id
   */
  create: function (requestObject) {
    var data = cleanData.call(this, requestObject);

    return this.client.create(data);
  },

  /**
   * Send to elasticsearch the partial document
   * with the id to update
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object that contains _id
   */
  update: function (requestObject) {
    var data = cleanData.call(this, requestObject);
    data.body = {doc: data.body};

    return this.client.update(data);
  },

  /**
   * Send to elasticsearch the document id to delete
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object that contains _id
   */
  delete: function (requestObject) {
    var data = cleanData.call(this, requestObject);

    return this.client.delete(data);
  },

  /**
   * Delete all document that match the given filter
   *
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object with ids
   */
  deleteByQuery: function (requestObject) {
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
  },

  /**
   * Delete type definition and all data for the type
   * @param {RequestObject} requestObject
   * @returns {Promise} resolve an object with the deleted collection name
   */
  deleteCollection: function (requestObject) {
    var
      deferred = q.defer(),
      data = cleanData.call(this, requestObject);

    this.client.indices.deleteMapping(data)
      .then(function () {
        deferred.resolve({collection: data.type});
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  },

  /**
   * Run several action and document
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  import: function (requestObject) {
    var
      nameActions = ['index', 'create', 'update', 'delete'],
      data = cleanData.call(this, requestObject);

    if (data.body) {
      // override index
      async.eachLimit(data.body, 20, function (item) {
        var action = Object.keys(item)[0];

        if (nameActions.indexOf(action) !== -1) {
          // TODO: implement multi index
          item[action]._index = this.kuzzleConfig[this.engineType].index;
        }
      }.bind(this));
    }

    return this.client.bulk(data);
  },

  /**
   * Add a mapping definition for a specific type
   *
   * @param {RequestObject} requestObject
   * @return {Promise}
   */
  putMapping: function (requestObject) {
    var data = cleanData.call(this, requestObject);

    return this.client.indices.putMapping(data);
  },

  /**
   * Retrieve mapping definition for index/type
   *
   * @param {RequestObject} requestObject
   * @return {Promise}
   */
  getMapping: function (requestObject) {
    var
      deferred = q.defer(),
      data = cleanData.call(this, requestObject);

    delete data.body;

    this.client.indices.getMapping(data)
      .then(function (result) {
        if (result[this.kuzzleConfig[this.engineType].index]) {
          deferred.resolve({data: result[this.kuzzleConfig[this.engineType].index]});
        }
        else {
          deferred.reject('No mapping for current index');
        }
      }.bind(this))
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  }
};

/**
 * Clean requestObject data: remove all attributes created for kuzzle,
 * add index if not defined and map the name 'collection' to 'type' for ES
 * @param {RequestObject} requestObject
 * @return {Object} data the data with cleaned attributes
 */
var cleanData = function (requestObject) {
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
};

/**
 * Scroll index in elasticsearch and return all document ids that match the filter
 * @param {Object} data
 * @returns {Promise} resolve an array
 */
var getAllIdsFromQuery = function (data) {
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
};