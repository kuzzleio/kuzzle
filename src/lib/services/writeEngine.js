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
  write: function (data) {
    data.type = data.collection;
    delete data.collection;

    data.index = this.kuzzle.config.writeEngine.index;

    data.body = data.content;
    delete data.content;

    delete data.action;
    delete data.controller;
    delete data.requestId;

    return this.client.create(data);
  }
};