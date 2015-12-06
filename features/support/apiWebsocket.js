var
  config = require('./config')(),
  q = require('q'),
  uuid = require('node-uuid'),
  io = require('socket.io-client');

module.exports = {
  world: null,
  responses: null,
  subscribedRooms: {},
  listSockets: {},

  init: function (world) {
    this.world = world;
    this.responses = null;

    initSocket.call(this, 'client1');
  },

  disconnect: function () {
    Object.keys(this.listSockets).forEach(function (socket) {
      this.listSockets[socket].destroy();
      delete this.listSockets[socket];
    }.bind(this));
  },

  get: function (id) {
    var
      msg = {
        controller: 'read',
        action: 'get',
        collection: this.world.fakeCollection,
        index: this.world.fakeIndex,
        _id: id
      };

    return emit.call(this, msg);
  },

  search: function (filters) {
    var
      msg = {
        controller: 'read',
        action: 'search',
        collection: this.world.fakeCollection,
        index: this.world.fakeIndex,
        body: filters
      };

    return emit.call(this, msg);
  },

  count: function (filters) {
    var
      msg = {
        controller: 'read',
        action: 'count',
        collection: this.world.fakeCollection,
        index: this.world.fakeIndex,
        body: filters
      };

    return emit.call(this, msg);
  },

  create: function (body, persist) {
    var
      msg = {
        controller: 'write',
        persist: persist,
        action: 'create',
        collection: this.world.fakeCollection,
        index: this.world.fakeIndex,
        body: body
      };

    return emit.call(this, msg);
  },

  createOrUpdate: function (body) {
    var
      msg = {
        controller: 'write',
        action: 'createOrUpdate',
        collection: this.world.fakeCollection,
        index: this.world.fakeIndex,
        body: body
      };

    return emit.call(this, msg);
  },

  update: function (id, body) {
    var
      msg = {
        controller: 'write',
        action: 'update',
        collection: this.world.fakeCollection,
        index: this.world.fakeIndex,
        _id: id,
        body: body
      };

    return emit.call(this, msg);
  },

  deleteById: function (id) {
    var
      msg = {
        controller: 'write',
        action: 'delete',
        collection: this.world.fakeCollection,
        index: this.world.fakeIndex,
        _id: id
      };

    return emit.call(this, msg);
  },

  deleteByQuery: function (filters) {
    var
      msg = {
        controller: 'write',
        action: 'deleteByQuery',
        collection: this.world.fakeCollection,
        index: this.world.fakeIndex,
        body: filters
      };

    return emit.call(this, msg);
  },

  deleteCollection: function () {
    var
      msg = {
        controller: 'admin',
        action: 'deleteCollection',
        index: this.world.fakeIndex,
        collection: this.world.fakeCollection
      };

    return emit.call(this, msg);
  },

  bulkImport: function (bulk) {
    var
      msg = {
        controller: 'bulk',
        action: 'import',
        index: this.world.fakeIndex,
        collection: this.world.fakeCollection,
        body: bulk
      };

    return emit.call(this, msg );
  },

  globalBulkImport: function (bulk) {
    var
      msg = {
        controller: 'bulk',
        action: 'import',
        index: this.world.fakeIndex,
        body: bulk
      };

    return emit.call(this, msg );
  },

  putMapping: function () {
    var
      msg = {
        controller: 'admin',
        action: 'putMapping',
        index: this.world.fakeIndex,
        collection: this.world.fakeCollection,
        body: this.world.schema
      };

    return emit.call(this, msg );
  },

  subscribe: function (filters, socketName) {
    var
      msg = {
        controller: 'subscribe',
        action: 'on',
        index: this.world.fakeIndex,
        collection: this.world.fakeCollection,
        body: null
      };

    if (filters) {
      msg.body = filters;
    }

    return emitAndListen.call(this, msg, socketName);

  },
  unsubscribe: function (room, socketName) {
    var
      msg = {
        controller: 'subscribe',
        action: 'off',
        index: this.world.fakeIndex,
        collection: this.world.fakeCollection,
        body: { roomId: room }
      };

    socketName = initSocket.call(this, socketName);

    this.listSockets[socketName].removeListener(room, this.subscribedRooms[socketName][room]);
    delete this.subscribedRooms[socketName][room];
    return emit.call(this, msg, false, socketName);
  },

  countSubscription: function (socketName) {
    socketName = initSocket.call(this, socketName);

    var
      rooms = Object.keys(this.subscribedRooms[socketName]),
      msg = {
        controller: 'subscribe',
        index: this.world.fakeIndex,
        action: 'count',
        body: {
          roomId: rooms[0]
        }
      };

    return emit.call(this, msg);
  },

  getStats: function (dates) {
    var
      msg = {
        controller: 'admin',
        action: 'getStats',
        body: dates
      };

    return emit.call(this, msg);
  },

  getLastStats: function () {
    var
        msg = {
          controller: 'admin',
          action: 'getLastStats'
        };

    return emit.call(this, msg);
  },

  getAllStats: function () {
    var
      msg = {
        controller: 'admin',
        action: 'getAllStats'
      };

    return emit.call(this, msg);
  },

  listCollections: function () {
    var msg = {
      controller: 'read',
      index: this.world.fakeIndex,
      action: 'listCollections'
    };

    return emit.call(this, msg );
  },

  now: function () {
    var msg = {
      controller: 'read',
      action: 'now'
    };

    return emit.call(this, msg );
  },


  deleteIndexes: function () {
    var
      msg = {
        controller: 'admin',
        action: 'deleteIndexes'
      };

    return emit.call(this, msg);
  },

  truncateCollection: function () {
    var
      msg = {
        controller: 'admin',
        index: this.world.fakeIndex,
        collection: this.world.fakeCollection,
        action: 'truncateCollection'
      };

    return emit.call(this, msg);
  }
};

var emit = function (msg, getAnswer, socketName) {
  var
    deferred = q.defer(),
    routename = 'kuzzle',
    listen = (getAnswer !== undefined) ? getAnswer : true;

  if (!msg.requestId) {
    msg.requestId = uuid.v1();
  }

  msg.metadata = this.world.metadata;

  socketName = initSocket.call(this, socketName);

  if (listen) {
    this.listSockets[socketName].once(msg.requestId, function (result) {
      if (result.error) {
        deferred.reject(result.error.message);
        return false;
      }

      deferred.resolve(result);
    });
  }
  else {
    deferred.resolve({});
  }

  this.listSockets[socketName].emit(routename, msg);

  return deferred.promise;
};

var emitAndListen = function (msg, socketName) {
  var
    deferred = q.defer(),
    routename = 'kuzzle';

  if (!msg.requestId) {
    msg.requestId = uuid.v1();
  }

  msg.metadata = this.world.metadata;

  socketName = initSocket.call(this, socketName);
  this.listSockets[socketName].once(msg.requestId, response => {
    var listener = function (document) {
      this.responses = document;
    };

    if (response.error) {
      deferred.reject(response.error.message);
      return false;
    }

    if (!this.subscribedRooms[socketName]) {
      this.subscribedRooms[socketName] = {};
    }

    this.subscribedRooms[socketName][response.result.roomId] = listener ;
    this.listSockets[socketName].on(response.result.roomId, listener.bind(this));
    deferred.resolve(response);
  });

  this.listSockets[socketName].emit(routename, msg);

  return deferred.promise;
};

var initSocket = function (socketName) {
  var socket;

  if (!socketName) {
    socketName = 'client1';
  }

  if (!this.listSockets[socketName]) {
    socket = io(config.url, { 'force new connection': true });
    this.listSockets[socketName] = socket;

    // the default socket is the socket with name 'client1'
    if ( socketName === 'client1' ) {
      this.socket = socket;
    }
  }

  return socketName;
};
