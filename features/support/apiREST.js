var
  config = require('./config')(),
  rp = require('request-promise');

module.exports = {

  world: null,

  init: function (world) {
    this.world = world;
  },

  disconnect: function () {
  },

  pathApi: function (path) {
    return config.url + '/api/' + path;
  },

  callApi: function (options) {
    return rp(options);
  },

  get: function (id) {
    var options = {
      url: this.pathApi(this.world.fakeCollection + '/' + id),
      method: 'GET',
      json: true
    };

    return this.callApi(options);
  },

  search: function (filters) {
    var options = {
      url: this.pathApi(this.world.fakeCollection + '/_search'),
      method: 'POST',
      json: filters
    };

    return this.callApi(options);
  },

  count: function (filters) {
    var options = {
      url: this.pathApi(this.world.fakeCollection + '/_count'),
      method: 'POST',
      json: filters
    };

    return this.callApi(options);
  },

  create: function (body) {
    var options = {
      url: this.pathApi(this.world.fakeCollection),
      method: 'POST',
      json: body
    };

    return this.callApi(options);
  },

  update: function (id, body) {
    var options = {
      url: this.pathApi(this.world.fakeCollection + '/' + id),
      method: 'PUT',
      json: body
    };

    return this.callApi(options);
  },

  deleteById: function (id) {
    var options = {
      url: this.pathApi(this.world.fakeCollection + '/' + id),
      method: 'DELETE',
      json: true
    };

    return this.callApi(options);
  },

  deleteByQuery: function (filters) {
    var options = {
      url: this.pathApi(this.world.fakeCollection + '/_query'),
      method: 'DELETE',
      json: filters
    };

    return this.callApi(options);
  },

  deleteCollection: function () {
    var options = {
      url: this.pathApi(this.world.fakeCollection),
      method: 'DELETE',
      json: true
    };

    return this.callApi(options);
  },

  bulkImport: function (bulk) {
    var options = {
      url: this.pathApi(this.world.fakeCollection + '/_bulk'),
      method: 'POST',
      json: bulk
    };

    return this.callApi(options);
  },

  globalBulkImport: function (bulk) {
      var options = {
        url: this.pathApi('/_bulk'),
        method: 'POST',
        json: bulk
      };

      return this.callApi(options);
    },

  putMapping: function () {
    var options = {
      url: this.pathApi(this.world.fakeCollection + '/_mapping'),
      method: 'PUT',
      json: this.world.schema
    };

    return this.callApi(options);
  }
};
