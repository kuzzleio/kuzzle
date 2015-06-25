var
  config = require('./config'),
  q = require('q'),
  uuid = require('node-uuid'),
  io = require('socket.io-client');

module.exports = {

  socket: null,
  world: null,
  responses: null,

  init: function (world) {
    this.world = world;
    this.socket = io(config.url);
  },

  get: function (id) {
    var
      msg = {
        action: 'get',
        collection: this.world.fakeCollection,
        _id: id
      };

    return emit.call(this, 'read', msg);
  },

  search: function (filters) {
    var
      msg = {
        action: 'search',
        collection: this.world.fakeCollection,
        body: filters
      };

    return emit.call(this, 'read', msg);
  },

  count: function (filters) {
    var
      msg = {
        action: 'count',
        collection: this.world.fakeCollection,
        body: filters
      };

    return emit.call(this, 'read', msg);
  },

  create: function (body, persist) {
    var
      msg = {
        persist: persist,
        action: 'create',
        collection: this.world.fakeCollection,
        body: body
      };

    return emit.call(this, 'write', msg);
  },

  update: function (id, body) {
    var
      msg = {
        action: 'update',
        collection: this.world.fakeCollection,
        _id: id,
        body: body
      };

    return emit.call(this, 'write', msg);
  },

  deleteById: function (id) {
    var
      msg = {
        action: 'delete',
        collection: this.world.fakeCollection,
        _id: id
      };

    return emit.call(this, 'write', msg);
  },

  deleteByQuery: function (filters) {
    var
      msg = {
        action: 'deleteByQuery',
        collection: this.world.fakeCollection,
        body: filters
      };

    return emit.call(this, 'write', msg);
  },

  deleteCollection: function () {
    var
      msg = {
        action: 'deleteCollection',
        collection: this.world.fakeCollection
      };

    return emit.call(this, 'admin', msg);
  },

  bulkImport: function (bulk) {
    var
      msg = {
        action: 'import',
        collection: this.world.fakeCollection,
        body: bulk
      };

    return emit.call(this, 'bulk', msg );
  },

  putMapping: function () {
    var
      msg = {
        action: 'putMapping',
        collection: this.world.fakeCollection,
        body: this.world.schema
      };

    return emit.call(this, 'admin', msg );
  },

  subscribe: function (filters) {
    var
      msg = {
        action: 'on',
        collection: this.world.fakeCollection,
        requestId: 'foobar',
        body: filters
      };

    return subscribeAndListen.call(this, 'subscribe', msg);
  }
};

var emit = function (controller, msg) {
  var
    requestId = uuid.v1(),
    deferred = q.defer();

  msg.requestId = requestId;

  this.socket.once(requestId, function (result) {
    if (result.error) {
      deferred.reject(result.error);
      return false;
    }

    deferred.resolve(result);
  });

  this.socket.emit(controller, msg );

  return deferred.promise;
};

var subscribeAndListen = function (controller, msg) {
  var
    requestId = uuid.v1(),
    deferred = q.defer();

  msg.requestId = requestId;
  this.socket.once(requestId, function (result) {
    if (result.error) {
      deferred.reject(result.error);
      return false;
    }

    this.socket.on(result.result, function (document) {
      this.responses = document;
    }.bind(this));

    deferred.resolve(result);
  }.bind(this));

  this.socket.emit(controller, msg);

  return deferred.promise;
};

