var
  _ = require('lodash'),
  q = require('q'),
  async = require('async'),
  es = require('elasticsearch');

module.exports = {

  kuzzle: null,
  client: null,
  engineType: '',

  /**
   * Initialize the elasticsearch client
   *
   * @param {Kuzzle} kuzzle
   * @param {String} engineType 'writeEngine' or 'readEngine'
   * @returns {Object} client
   */
  init: function (kuzzle, engineType) {
    if (this.client) {
      return this.client;
    }

    this.kuzzle = kuzzle;
    this.engineType = engineType;

    if (this.kuzzle.config[this.engineType].host.indexOf(',') !== -1) {
      this.kuzzle.config[this.engineType].host = this.kuzzle.config[this.engineType].host.split(',');
    }

    this.client = new es.Client({
      host: this.kuzzle.config[this.engineType].host,
      apiVersion: this.kuzzle.config[this.engineType].apiVersion
    });

    return this.client;
  },

  /**
   * Search documents from elasticsearch with a query
   * @param data
   * @returns {Promise} resolve documents matching the filter
   */
  search: function (data) {
    var deferred = q.defer();

    cleanData.call(this, data);

    this.client.search(data)
      .then(function (result) {
        deferred.resolve({data: result});
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  },

  /**
   * Get the document with given ID
   * @param {Object} data contains id
   * @returns {Promise} resolve the document
   */
  get: function (data) {
    var deferred = q.defer();

    cleanData.call(this, data);

    delete data.body;

    this.client.get(data)
      .then(function (result) {
        deferred.resolve({data: result});
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
   * @param {Object} data
   * @returns {Promise} resolve an object that contains _id
   */
  create: function (data) {
    cleanData.call(this, data);
    return this.client.create(data);
  },

  /**
   * Send to elasticsearch the partial document
   * with the id to update
   *
   * @param {Object} data
   * @returns {Promise} resolve an object that contains _id
   */
  update: function (data) {
    cleanData.call(this, data);
    data.body = {doc: data.body};

    return this.client.update(data);
  },

  /**
   * Send to elasticsearch the document id to delete
   *
   * @param {Object} data
   * @returns {Promise} resolve an object that contains _id
   */
  delete: function (data) {
    cleanData.call(this, data);
    return this.client.delete(data);
  },

  /**
   * Delete all document that match the given filter
   *
   * @param {Object} data
   * @returns {Promise} resolve an object with ids
   */
  deleteByQuery: function (data) {
    var
      deferred = q.defer(),
      bodyBulk = [];

    cleanData.call(this, data);
    data.scroll = '30s';

    getAllIdsFromQuery.call(this, data)
      .then(function (ids) {
        async.each(ids, function (id, callback) {
          bodyBulk.push({delete: {_index: data.index, _type: data.type, _id: id}});
          callback();
        }, function () {

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
   * @param {Object} data
   * @returns {Promise} resolve an object with the deleted collection name
   */
  deleteCollection: function (data) {
    var deferred = q.defer();

    cleanData.call(this, data);

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
   * @param {Object} data
   * @returns {Promise}
   */
  import: function (data) {
    var nameActions = ['index', 'create', 'update', 'delete'];

    cleanData.call(this, data);

    if (data.body) {
      // override index
      async.eachLimit(data.body, 20, function (item) {
        var action = Object.keys(item)[0];

        if (nameActions.indexOf(action) !== -1) {
          // TODO: implement multi index
          item[action]._index = this.kuzzle.config[this.engineType].index;
        }
      }.bind(this));
    }

    return this.client.bulk(data);
  },

  /**
   * Add a mapping definition for a specific type
   *
   * @param {Object} data
   * @return {Promise}
   */
  putMapping: function (data) {
    cleanData.call(this, data);
    return this.client.indices.putMapping(data);
  },

  /**
   * Retrieve mapping definition for index/type
   *
   * @param {Object} data
   * @return {Promise}
   */
  getMapping: function (data) {
    var deferred = q.defer();

    cleanData.call(this, data);
    delete data.body;

    this.client.indices.getMapping(data)
      .then(function (result) {
        if (result[this.kuzzle.config[this.engineType].index]) {
          deferred.resolve({data: result[this.kuzzle.config[this.engineType].index]});
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
 * Clean object data: remove all attributes created for kuzzle,
 * add index if not defined and map the name 'collection' to 'type' for ES
 * @param {Object} data
 */
var cleanData = function (data) {

  if (data.collection !== undefined) {
    data.type = data.collection;
  }

  data.id = data._id;
  delete data._id;

  if (data.index === undefined) {
    // TODO: implement multi index
    data.index = this.kuzzle.config[this.engineType].index;
  }

  delete data.collection;
  delete data.persist;
  delete data.controller;
  delete data.action;
  delete data.requestId;
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
      }, getMoreUntilDone);
    }
    else {
      deferred.resolve(ids);
    }
    /* jshint camelcase: true */
  }.bind(this));

  return deferred.promise;
};