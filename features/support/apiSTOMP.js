var
  config = require('./config')(),
  stomp = require('stomp-client'),
  uuid = require('node-uuid'),
  q = require('q'),
  KUZZLE_EXCHANGE = 'amq.topic';

module.exports = {
  world: null,
  stompUrl: undefined,
  stompClient: undefined,
  stompConnected: undefined,
  clientId: uuid.v1(),
  subscribedRooms: null,
  responses: null,

  init: function (world) {
    var deferredConnection;

    this.stompUrl = config.stompUrl.replace('stomp://', '').split(':');

    if (!this.stompClient) {
      this.stompClient = new stomp(this.stompUrl[0], this.stompUrl[1], 'guest', 'guest', '1.0', '/');

      deferredConnection = q.defer();
      this.stompConnected = deferredConnection.promise;
      this.stompClient.connect(function (sessionId) {
        deferredConnection.resolve(sessionId);
      });
    }
    this.world = world;
    this.subscribedRooms = {};
    this.responses = null;
  },

  disconnect: function () {
    if (this.stompClient) {
      this.stompClient.disconnect();
      this.stompClient = null;
    }
  },

  create: function (body, persist) {
    var
      msg = {
        controller: 'write',
        collection: this.world.fakeCollection,
        action: 'create',
        persist: persist,
        body: body
      };

    return publish.call(this, msg);
  },

  createOrUpdate: function (body) {
    var
      msg = {
        controller: 'write',
        collection: this.world.fakeCollection,
        action: 'createOrUpdate',
        body: body
      };

    return publish.call(this, msg);
  },

  get: function (id) {
    var
      msg = {
        controller: 'read',
        collection: this.world.fakeCollection,
        action: 'get',
        _id: id
      };

    return publish.call(this, msg);
  },

  search: function (filters) {
    var
      msg = {
        controller: 'read',
        collection: this.world.fakeCollection,
        action: 'search',
        body: filters
      };

    return publish.call(this, msg);
  },

  count: function (filters) {
    var
      msg = {
        controller: 'read',
        collection: this.world.fakeCollection,
        action: 'count',
        body: filters
      };

    return publish.call(this, msg);
  },

  update: function (id, body) {
    var
      msg = {
        controller: 'write',
        collection: this.world.fakeCollection,
        action: 'update',
        _id: id,
        body: body
      };

    return publish.call(this, msg);
  },

  deleteById: function (id) {
    var
      msg = {
        controller: 'write',
        collection: this.world.fakeCollection,
        action: 'delete',
        _id: id
      };

    return publish.call(this, msg);
  },

  deleteByQuery: function (filters) {
    var
      msg = {
        controller: 'write',
        collection: this.world.fakeCollection,
        action: 'deleteByQuery',
        body: filters
      };

    return publish.call(this, msg);
  },

  deleteCollection: function () {
    var
      msg = {
        controller: 'admin',
        collection: this.world.fakeCollection,
        action: 'deleteCollection',
      };

    return publish.call(this, msg);
  },

  putMapping: function () {
    var
      msg = {
        controller: 'admin',
        collection: this.world.fakeCollection,
        action: 'putMapping',
        body: this.world.schema
      };

    return publish.call(this, msg);
  },

  bulkImport: function (bulk) {
    var
      msg = {
        controller: 'bulk',
        collection: this.world.fakeCollection,
        action: 'import',
        body: bulk
      };

    return publish.call(this, msg);
  },

  globalBulkImport: function (bulk) {
    var
      msg = {
        controller: 'bulk',
        action: 'import',
        body: bulk
      };

    return publish.call(this, msg);
  },

  subscribe: function (filters) {
    var
      msg = {
        controller: 'subscribe',
        collection: this.world.fakeCollection,
        action: 'on',
        body: null
      };

    if (filters) {
      msg.body = filters;
    }

    return publishAndListen.call(this, msg);
  },

  unsubscribe: function (room, clientId) {
    var
      msg = {
        clientId: clientId,
        controller: 'subscribe',
        collection: this.world.fakeCollection,
        action: 'off',
        body: { roomId: room }
      };

    this.subscribedRooms[clientId][room].disconnect();
    delete this.subscribedRooms[clientId][room];

    return publish.call(this, msg, false);
  },

  countSubscription: function () {
    var
      clients = Object.keys(this.subscribedRooms),
      rooms = Object.keys(this.subscribedRooms[clients[0]]),
      msg = {
        controller: 'subscribe',
        collection: this.world.fakeCollection,
        action: 'count',
        body: {
          roomId: rooms[0]
        }
      };

    return publish.call(this, msg);
  },

  getStats: function (dates) {
    var
      msg = {
        controller: 'admin',
        action: 'getStats',
        body: dates
      };

    return publish.call(this, msg);
  },

  getLastStats: function () {
    var
        msg = {
          controller: 'admin',
          action: 'getLastStats'
        };

    return publish.call(this, msg);
  },

  getAllStats: function () {
    var
      msg = {
        controller: 'admin',
        action: 'getAllStats'
      };

    return publish.call(this, msg);
  },

  listCollections: function () {
    var
      msg = {
        controller: 'read',
        action: 'listCollections'
      };

    return publish.call(this, msg);
  },

  now: function () {
    var
      msg = {
        controller: 'read',
        action: 'now'
      };

    return publish.call(this, msg);
  },

  truncateCollection: function () {
    var
      msg = {
        controller: 'admin',
        collection: this.world.fakeCollection,
        action: 'truncateCollection'
      };

    return publish.call(this, msg);
  }
};

var publish = function (message, waitForAnswer) {
  var
    deferred = q.defer(),
    topic = 'kuzzle',
    listen = (waitForAnswer !== undefined) ? waitForAnswer : true,
    destination = ['/exchange', KUZZLE_EXCHANGE, topic].join('/'),
    messageHeader = {
      'content-type': 'application/json'
    };

  if (!message.clientId) {
    message.clientId = uuid.v1();
  }

  message.metadata = this.world.metadata;

  this.stompConnected
    .then(function () {
      if (listen) {
        messageHeader['reply-to'] = uuid.v1();
        this.stompClient.subscribe('/queue/' + messageHeader['reply-to'], function (body, headers) {
          var unpacked = JSON.parse(body);

          if (unpacked.error) {
            deferred.reject(unpacked.error);
          }
          else {
            deferred.resolve(unpacked);
          }

          this.stompClient.unsubscribe(headers.destination);
        }.bind(this));
      }
      else {
        deferred.resolve({});
      }

      this.stompClient.publish(destination, JSON.stringify(message), messageHeader);
    }.bind(this))
    .catch(function (error) {
      deferred.reject(error);
    });

  return deferred.promise;
};

var publishAndListen = function (message) {
  var
    roomClient = new stomp(this.stompUrl[0], this.stompUrl[1], 'guest', 'guest', '1.0', '/'),
    deferred = q.defer(),
    self = this;

  message.clientId = uuid.v1();
  self.subscribedRooms[message.clientId] = {};

  publish.call(this, message)
    .then(function (response) {
      roomClient.connect(function () {
        var topic = '/topic/' + response.result.roomId;

        self.subscribedRooms[message.clientId][response.result.roomId] = roomClient;

        roomClient.subscribe(topic, function (body) { //, headers) {
          self.responses = JSON.parse(body);
        });

        deferred.resolve(response);
      });
    })
    .catch(function (error) {
      deferred.reject(error);
    });

  return deferred.promise;
};
