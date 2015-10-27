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

  createOrUpdate: function (body) {
    var
      msg = {
        action: 'createOrUpdate',
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

  globalBulkImport: function (bulk) {
    var
      msg = {
        action: 'import',
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

  subscribe: function (filters, socketName) {
    var
      msg = {
        action: 'on',
        collection: this.world.fakeCollection,
        body: null
      };

    if (filters) {
      msg.body = filters;
    }

    return emitAndListen.call(this, 'subscribe', msg, socketName);

  },
  unsubscribe: function (room, socketName) {
    var
      msg = {
        action: 'off',
        collection: this.world.fakeCollection,
        requestId: room
      };

    socketName = initSocket.call(this, socketName);

    this.listSockets[socketName].removeListener(this.subscribedRooms[socketName][room], this.subscribedRooms[socketName][room].listener);
    delete this.subscribedRooms[socketName][room];
    return emit.call(this, 'subscribe', msg, false, socketName);
  },

  countSubscription: function (socketName) {
    socketName = initSocket.call(this, socketName);

    var
      rooms = Object.keys(this.subscribedRooms[socketName]),
      msg = {
        action: 'count',
        body: {
          roomId: this.subscribedRooms[socketName][rooms[0]].roomId
        }
      };

    return emit.call(this, 'subscribe', msg);
  },

  getStats: function () {
    var
      msg = {
        action: 'getStats'
      };

    return emit.call(this, 'admin', msg);
  },

  getAllStats: function () {
    var
      msg = {
        action: 'getAllStats'
      };

    return emit.call(this, 'admin', msg);
  },

  listCollections: function () {
    var msg = {action: 'listCollections'};

    return emit.call(this, 'read', msg );
  }
};

var emit = function (controller, msg, getAnswer, socketName) {
  var
    deferred = q.defer(),
    listen = (getAnswer !== undefined) ? getAnswer : true;

  if (!msg.requestId) {
    msg.requestId = uuid.v1();
  }

  socketName = initSocket.call(this, socketName);

  if (listen) {
    this.listSockets[socketName].once(msg.requestId, function (result) {
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

  this.listSockets[socketName].emit(controller, msg);

  return deferred.promise;
};

var emitAndListen = function (controller, msg, socketName) {
  var
    deferred = q.defer();

  if (!msg.requestId) {
    msg.requestId = uuid.v1();
  }

  socketName = initSocket.call(this, socketName);
  this.listSockets[socketName].once(msg.requestId, function (response) {
    var listener = function (document) {
      this.responses = document;
    };

    if (response.error) {
      deferred.reject(response.error);
      return false;
    }

    if (!this.subscribedRooms[socketName]) {
      this.subscribedRooms[socketName] = {};
    }

    this.subscribedRooms[socketName][response.result.roomName] = { roomId: response.result.roomId, listener: listener };
    this.listSockets[socketName].on(response.result.roomId, listener.bind(this));
    deferred.resolve(response);
  }.bind(this));

  this.listSockets[socketName].emit(controller, msg);

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
