var
  config = require('./config')(),
  rp = require('request-promise');

var ApiREST = function () {
  this.world = null;
};

ApiREST.prototype.init = function (world) {
  this.world = world;
};

ApiREST.prototype.disconnect = function () {};

ApiREST.prototype.pathApi = function (path) {
  return config.url + '/api/v1/' + path;
};

ApiREST.prototype.callApi = function (options) {
  return rp(options);
};

ApiREST.prototype.get = function (id) {
  var options = {
    url: this.pathApi(this.world.fakeIndex + '/' + this.world.fakeCollection + '/' + id),
    method: 'GET',
    json: true
  };

  return this.callApi(options);
};

ApiREST.prototype.search = function (filters) {
  var options = {
    url: this.pathApi(this.world.fakeIndex + '/' + this.world.fakeCollection + '/_search'),
    method: 'POST',
    json: filters
  };

  return this.callApi(options);
};

ApiREST.prototype.count = function (filters) {
  var options = {
    url: this.pathApi(this.world.fakeIndex + '/' + this.world.fakeCollection + '/_count'),
    method: 'POST',
    json: filters
  };

  return this.callApi(options);
};

ApiREST.prototype.create = function (body) {
  var options = {
    url: this.pathApi(this.world.fakeIndex + '/' + this.world.fakeCollection),
    method: 'POST',
    json: body
  };

  return this.callApi(options);
};

ApiREST.prototype.createOrUpdate = function (body) {
  var options = {
    url: this.pathApi(this.world.fakeIndex + '/' + this.world.fakeCollection + '/' + body._id),
    method: 'PUT',
    json: body
  };

  return this.callApi(options);
};

ApiREST.prototype.update = function (id, body) {
  var options = {
    url: this.pathApi(this.world.fakeIndex + '/' + this.world.fakeCollection + '/' + id + '/_update'),
    method: 'PUT',
    json: body
  };

  return this.callApi(options);
};

ApiREST.prototype.deleteById = function (id) {
  var options = {
    url: this.pathApi(this.world.fakeIndex + '/' + this.world.fakeCollection + '/' + id),
    method: 'DELETE',
    json: true
  };

  return this.callApi(options);
};

ApiREST.prototype.deleteByQuery = function (filters) {
  var options = {
    url: this.pathApi(this.world.fakeIndex + '/' + this.world.fakeCollection + '/_query'),
    method: 'DELETE',
    json: filters
  };

  return this.callApi(options);
};

ApiREST.prototype.deleteCollection = function () {
  var options = {
    url: this.pathApi(this.world.fakeIndex + '/' + this.world.fakeCollection),
    method: 'DELETE',
    json: true
  };

  return this.callApi(options);
};

ApiREST.prototype.bulkImport = function (bulk) {
  var options = {
    url: this.pathApi(this.world.fakeIndex + '/' + this.world.fakeCollection + '/_bulk'),
    method: 'POST',
    json: bulk
  };

  return this.callApi(options);
};

ApiREST.prototype.globalBulkImport = function (bulk) {
  var options = {
    url: this.pathApi('_bulk'),
    method: 'POST',
    json: bulk
  };

  return this.callApi(options);
};

ApiREST.prototype.putMapping = function () {
  var options = {
    url: this.pathApi(this.world.fakeIndex + '/' + this.world.fakeCollection + '/_mapping'),
    method: 'PUT',
    json: this.world.schema
  };

  return this.callApi(options);
};

ApiREST.prototype.getStats = function (dates) {
  var options = {
    url: this.pathApi('_getStats'),
    method: 'POST',
    json: dates
  };
  console.log(options);

  return this.callApi(options);
};

ApiREST.prototype.getLastStats = function () {
  var options = {
    url: this.pathApi('_getLastStats'),
    method: 'GET',
    json: {}
  };
  console.log(options);

  return this.callApi(options);
};

ApiREST.prototype.getAllStats = function () {
  var options = {
    url: this.pathApi('_getAllStats'),
    method: 'GET',
    json: {}
  };

  return this.callApi(options);
};

ApiREST.prototype.listCollections = function () {
  var options = {
    url: this.pathApi(this.world.fakeIndex + '/' + '_listCollections'),
    method: 'GET',
    json: true
  };

  return this.callApi(options);
};

ApiREST.prototype.now = function () {
  var options = {
    url: this.pathApi('_now'),
    method: 'GET',
    json: true
  };

  return this.callApi(options);
};

ApiREST.prototype.truncateCollection = function () {
  var options = {
    url: this.pathApi(this.world.fakeIndex + '/' + this.world.fakeCollection + '/_truncate'),
    method: 'DELETE',
    json: true
  };

  return this.callApi(options);
};

ApiREST.prototype.deleteIndexes = function () {
  var options = {
    url: this.pathApi('_deleteIndexes'),
    method: 'DELETE',
    json: true
  };

  return this.callApi(options);
};

module.exports = ApiREST;