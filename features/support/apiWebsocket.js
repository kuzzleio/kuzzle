var
  config = require('./config'),
  q = require('q'),
  uuid = require('node-uuid'),
  io = require('socket.io-client');

module.exports = {

  socket: null,
  world: null,
  responses: null,
  subscribedRooms: {},

  init: function (world) {
    this.world = world;

    if ( !this.socket ) {
      this.socket = io(config.url);
    }
  },

  disconnect: function () {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
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
        body: filters
      };

      return emitAndListen.call(this, 'subscribe', msg);
  },

  unsubscribe: function (room) {
    var
      msg = {
        action: 'off',
        collection: this.world.fakeCollection,
        requestId: room
      };

    this.socket.off(this.subscribedRooms[room]);
    delete this.subscribedRooms[room];
    return emit.call(this, 'subscribe', msg, false);
  }
};

var emit = function (controller, msg, getAnswer) {
  var
    deferred = q.defer(),
    listen = (getAnswer !== undefined) ? getAnswer : true;

  if (!msg.requestId) {
    msg.requestId = uuid.v1();
  }

  if (listen) {
    this.socket.once(msg.requestId, function (result) {
      if (result.error) {
        deferred.reject(result.error);
        return false;
      }

      deferred.resolve(result);
    });
  }
  else {
    deferred.resolve({});
  }

  this.socket.emit(controller, msg );

  return deferred.promise;
};

var emitAndListen = function (controller, msg) {
  var
    deferred = q.defer();

  if (!msg.requestId) {
    msg.requestId = uuid.v1();
  }

  this.socket.once(msg.requestId, function (result) {
    if (result.error) {
      deferred.reject(result.error);
      return false;
    }

    this.subscribedRooms[msg.requestId] = result.result;

    this.socket.on(result.result, function (document) {
      this.responses = document;
    }.bind(this));

    deferred.resolve(result);
  }.bind(this));

  this.socket.emit(controller, msg);

  return deferred.promise;
};
