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
   * Send to elasticsearch the new document
   * Clean data for match the elasticsearch specification
   *
   * @param {Object} data
   */
  create: function (data) {
    data.type = data.collection;
    delete data.collection;

    data.index = this.kuzzle.config.writeEngine.index;

    data.body = data.content;
    delete data.content;

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

    data.index = this.kuzzle.config.writeEngine.index;

    data.body = data.content;
    delete data.content;

    data.id = data.body.id;
    delete data.body.id;
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

    data.index = this.kuzzle.config.writeEngine.index;

    data.id = data.content.id;
    delete data.content;

    delete data.action;
    delete data.controller;
    delete data.requestId;


    return this.client.delete(data);
  }
};