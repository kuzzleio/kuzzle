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
    data.index = this.kuzzle.config.readEngine.index;

    data.type = data.collection;
    delete data.collection;

    data.body = data.content;
    delete data.content;

    // If an id is defined we can extend the filter for add a filter on the id
    // useful in case we are in get /:collection/:id
    if (data._id) {
      if (!Array.isArray(data._id)) {
        data._id = [data._id];
      }

      if (data.body === undefined) {
        data.body = {};
      }

      data.body = _.extend(data.body, {ids: {values: data._id}});
    }

    var key = Object.keys(data.body)[0];
    // if no of those word is the first key, wrap into a default filter (for match with subscribe
    // where we haven't 'filter' defined)
    if (key !== 'filtered' || key !== 'query' || key !== 'filter' || key !== 'facets') {
      data.body = {
        filter: data.body
      };
    }

    return this.client.search(data);
  }
};