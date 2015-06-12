var
  config = require('./config'),
  q = require('q'),
  uuid = require('node-uuid'),
  io = require('socket.io-client');

module.exports = {

  socket: null,
  world: null,

  init: function (world) {
    this.world = world;
    this.socket = io(config.url);
  },

  get: function (id) {
    var
      deferred = q.defer(),
      requestId = uuid.v1();

    this.socket.once(requestId, function(result) {
      if (result.error) {
        deferred.reject(result.error);
        return false;
      }

      deferred.resolve(result);
    }.bind(this));

    this.socket.emit('read', {
      requestId: requestId,
      action: 'get',
      collection: this.world.fakeCollection,
      id: id
    });

    return deferred.promise;
  },

  search: function (filters) {
    var
      deferred = q.defer(),
      requestId = uuid.v1();

    this.socket.once(requestId, function(result) {
      if (result.error) {
        deferred.reject(result.error);
        return false;
      }

      deferred.resolve(result);
    }.bind(this));

    this.socket.emit('read', {
      requestId: requestId,
      action: 'search',
      collection: this.world.fakeCollection,
      body: filters
    });

    return deferred.promise;
  },

  create: function (body, persist) {
    var
      deferred = q.defer(),
      msg,
      requestId = uuid.v1();

    if (persist === undefined) {
      persist = false;
    }

    this.socket.once(requestId, function (result) {
      if (result.error) {
        deferred.reject(result.error);
        return false;
      }

      deferred.resolve(result);
    }.bind(this));

    msg = {
      requestId: requestId,
      persist: persist,
      action: 'create',
      collection: this.world.fakeCollection,
      body: body
    };

    this.socket.emit('write', msg );

    return deferred.promise;
  },

  update: function (id, body) {
    var
      deferred = q.defer(),
      requestId = uuid.v1(),
      msg;

    this.socket.once(requestId, function (result) {
      if (result.error) {
        deferred.reject(result.error);
        return false;
      }

      deferred.resolve(result);
    }.bind(this));

    msg = {
      requestId: requestId,
      action: 'update',
      collection: this.world.fakeCollection,
      id: id,
      body: body
    };

    this.socket.emit('write', msg );

    return deferred.promise;
  },

  deleteById: function (id) {
    var
      deferred = q.defer(),
      requestId = uuid.v1(),
      msg;

    this.socket.once(requestId, function (result) {
      if (result.error) {
        deferred.reject(result.error);
        return false;
      }

      deferred.resolve(result);
    }.bind(this));

    msg = {
      requestId: requestId,
      action: 'delete',
      collection: this.world.fakeCollection,
      id: id
    };

    this.socket.emit('write', msg );

    return deferred.promise;
  },

  deleteByQuery: function (filters) {
    var
      deferred = q.defer(),
      requestId = uuid.v1(),
      msg;

    this.socket.once(requestId, function (result) {
      if (result.error) {
        deferred.reject(result.error);
        return false;
      }

      deferred.resolve(result);
    }.bind(this));

    msg = {
      requestId: requestId,
      action: 'deleteByQuery',
      collection: this.world.fakeCollection,
      body: filters
    };

    this.socket.emit('write', msg );

    return deferred.promise;
  },

  deleteCollection: function () {
    var
      deferred = q.defer(),
      msg,
      requestId = uuid.v1();

    this.socket.once(requestId, function (result) {
      if (result.error) {
        deferred.reject(result.error);
        return false;
      }

      deferred.resolve(result);
    }.bind(this));

    msg = {
      requestId: requestId,
      action: 'deleteCollection',
      collection: this.world.fakeCollection
    };

    this.socket.emit('admin', msg );

    return deferred.promise;
  },

  bulkImport: function (bulk) {
    var
      deferred = q.defer(),
      msg,
      requestId = uuid.v1();

    this.socket.once(requestId, function (result) {
      if (result.error) {
        deferred.reject(result.error);
        return false;
      }

      deferred.resolve(result);
    }.bind(this));

    msg = {
      requestId: requestId,
      action: 'import',
      collection: this.world.fakeCollection,
      body: bulk
    };

    this.socket.emit('bulk', msg );

    return deferred.promise;
  }
};