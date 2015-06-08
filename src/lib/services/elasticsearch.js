var
  _ = require('lodash'),
  es = require('elasticsearch');

module.exports = {

  kuzzle: null,
  client: null,

  /**
   * Initialize the elasticsearch client
   *
   * @param {Kuzzle} kuzzle
   * @returns {Object} client
   */
  init: function (kuzzle) {
    if (this.client) {
      return this.client;
    }

    this.kuzzle = kuzzle;

    if (this.kuzzle.config.writeEngine.host.indexOf(',') !== -1) {
      this.kuzzle.config.writeEngine.host = this.kuzzle.config.writeEngine.host.split(',');
    }

    this.client = new es.Client({
      host: this.kuzzle.config.writeEngine.host
    });

    return this.client;
  },

  /**
   * Read document from elasticsearch
   * @param data
   * @returns {Object}
   */
  read: function (data) {
    if (data.index === undefined) {
      data.index = this.kuzzle.config.writeEngine.index;
    }

    if (data.collection) {
      data.type = data.collection;
      delete data.collection;
    }

    // If an id is defined we can extend the filter for add a filter on the id
    // useful in case we are in get /:collection/:id
    if (data.id) {
      if (!Array.isArray(data.id)) {
        data.id = [data.id];
      }

      if (data.body === undefined) {
        data.body = {};
      }

      data.body = _.extend(data.body, {ids: {values: data.id}});
    }

    var key = Object.keys(data.body)[0];
    // if no of those word is the first key, wrap into a default filter (for match with subscribe
    // where we haven't 'filter' defined)
    if (key !== 'filtered' || key !== 'query' || key !== 'filter' || key !== 'facets') {
      data.body = {
        filter: data.body
      };
    }

    delete data.controller;
    delete data.action;
    delete data.id;

    return this.client.search(data);
  },

  /**
   * Send to elasticsearch the new document
   * Clean data for match the elasticsearch specification
   *
   * @param {Object} data
   */
  create: function (data) {
    data.type = data.collection;
    delete data.collection;

    if (data.index === undefined) {
      data.index = this.kuzzle.config.writeEngine.index;
    }

    delete data.action;
    delete data.controller;
    delete data.requestId;
    delete data.persist;

    return this.client.create(data);
  },

  /**
   * Send to elasticsearch the partial document
   * with the id to update
   *
   * @param {Object} data
   */
  update: function (data) {
    data.type = data.collection;
    delete data.collection;

    if (data.index === undefined) {
      data.index = this.kuzzle.config.writeEngine.index;
    }

    if (data.body.id) {
      data.id = data.body.id;
      delete data.body.id;
    }

    data.body = {doc: data.body};

    delete data.action;
    delete data.controller;
    delete data.requestId;

    return this.client.update(data);
  },

  /**
   * Send to elasticsearch the document id
   * that we have to delete
   *
   * @param {Object} data
   */
  delete: function (data) {
    data.type = data.collection;
    delete data.collection;

    if (data.index === undefined) {
      data.index = this.kuzzle.config.writeEngine.index;
    }

    delete data.action;
    delete data.controller;
    delete data.requestId;


    return this.client.delete(data);
  },

  /**
   * Send to elasticsearch the query
   * for delete several documents
   *
   * @param {Object} data
   */
  deleteByQuery: function (data) {
    var params = {
      index: data.index || this.kuzzle.config.writeEngine.index,
      type: data.collection,
      q: '*'
    };

    return this.client.deleteByQuery(params);
  }
};