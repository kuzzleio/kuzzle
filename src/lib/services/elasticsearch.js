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
   * @returns {Promise}
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
   * @returns {Promise}
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
   * @returns {Promise}
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
   * @returns {Promise}
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
   * @returns {Promise}
   */
  delete: function (data) {
    cleanData.call(this, data);
    return this.client.delete(data);
  },

  /**
   * Send to elasticsearch the query
   * for delete several documents
   *
   * @param {Object} data
   * @returns {Promise}
   */
  deleteByQuery: function (data) {
    cleanData.call(this, data);
    return this.client.deleteByQuery(data);
  },

  /**
   * Delete type definition and all data for the type
   * @param {Object} data
   * @returns {Promise}
   */
  deleteCollection: function (data) {
    cleanData.call(this, data);
    return this.client.indices.deleteMapping(data);
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