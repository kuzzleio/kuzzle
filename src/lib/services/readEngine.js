var
  _ = require('lodash'),
  es = require('elasticsearch');

module.exports = {

  kuzzle: null,
  client: null,

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
  }
};