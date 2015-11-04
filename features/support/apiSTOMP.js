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
      topic = ['write', this.world.fakeCollection, 'create'].join('.'),
      msg = {
        persist: persist,
        body: body
      };

    return publish.call(this, topic, msg);
  },

  createOrUpdate: function (body) {
    var
      topic = ['write', this.world.fakeCollection, 'createOrUpdate'].join('.'),
      msg = {
        body: body
      };

    return publish.call(this, topic, msg);
  },

  get: function (id) {
    var
      topic = ['read', this.world.fakeCollection, 'get'].join('.'),
      msg = {
        _id: id
      };

    return publish.call(this, topic, msg);
  },

  search: function (filters) {
    var
      topic = ['read', this.world.fakeCollection, 'search'].join('.'),
      msg = {
        body: filters
      };

    return publish.call(this, topic, msg);
  },

  update: function (id, body) {
    var
      topic = ['write', this.world.fakeCollection, 'update'].join('.'),
      msg = {
        _id: id,
        body: body
      };

    return publish.call(this, topic, msg);
  },

  count: function (filters) {
    var
      topic = ['read', this.world.fakeCollection, 'count'].join('.'),
      msg = {
        body: filters
      };

    return publish.call(this, topic, msg);
  },

  deleteById: function (id) {
    var
      topic = ['write', this.world.fakeCollection, 'delete'].join('.'),
      msg = {
        _id: id
      };

    return publish.call(this, topic, msg);
  },

  deleteByQuery: function (filters) {
    var
      topic = ['write', this.world.fakeCollection, 'deleteByQuery'].join('.'),
      msg = {
        body: filters
      };

    return publish.call(this, topic, msg);
  },

  deleteCollection: function () {
    var
      topic = ['admin', this.world.fakeCollection, 'deleteCollection'].join('.'),
      msg = {};

    return publish.call(this, topic, msg);
  },

  putMapping: function () {
    var
      topic = ['admin', this.world.fakeCollection, 'putMapping'].join('.'),
      msg = {
        body: this.world.schema
      };

    return publish.call(this, topic, msg);
  },

  bulkImport: function (bulk) {
    var
      topic = ['bulk', this.world.fakeCollection, 'import'].join('.'),
      msg = {
        body: bulk
      };

    return publish.call(this, topic, msg);
  },

  globalBulkImport: function (bulk) {
    var
      topic = ['bulk', '', 'import'].join('.'),
      msg = {
        body: bulk
      };

    return publish.call(this, topic, msg);
  },

  subscribe: function (filters) {
    var
      topic = ['subscribe', this.world.fakeCollection, 'on'].join('.'),
      msg = {
        body: null
      };

    if (filters) {
      msg.body = filters;
    }

    return publishAndListen.call(this, topic, msg);
  },

  unsubscribe: function (room, clientId) {
    var
      topic = ['subscribe', this.world.fakeCollection, 'off'].join('.'),
      msg = {
        body: { roomId: room },
        clientId: clientId
      };

    this.subscribedRooms[clientId][room].disconnect();
    delete this.subscribedRooms[clientId][room];
    return publish.call(this, topic, msg, false);
  },

  countSubscription: function () {
    var
      topic = ['subscribe', this.world.fakeCollection, 'count'].join('.'),
      clients = Object.keys(this.subscribedRooms),
      rooms = Object.keys(this.subscribedRooms[clients[0]]),
      msg = {
        body: {
          roomId: rooms[0]
        }
      };

    return publish.call(this, topic, msg);
  },

  getStats: function () {
    var
      topic = ['admin', '', 'getStats'].join('.'),
      msg = {};

    return publish.call(this, topic, msg);
  },

  getAllStats: function () {
    var
      topic = ['admin', '', 'getAllStats'].join('.'),
      msg = {};

    return publish.call(this, topic, msg);
  },

  listCollections: function () {
    var
      topic = ['read', '', 'listCollections'].join('.'),
      msg = {};

    return publish.call(this, topic, msg);
  }
};

var publish = function (topic, message, waitForAnswer) {
  var
    deferred = q.defer(),
    listen = (waitForAnswer === undefined) ? true : waitForAnswer,
    destination = ['/exchange', KUZZLE_EXCHANGE, topic].join('/'),
    messageHeader = {
      'content-type': 'application/json'
    };

  if (!message.clientId) {
    message.clientId = uuid.v1();
  }

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

var publishAndListen = function (topic, message) {
  var
    roomClient = new stomp(this.stompUrl[0], this.stompUrl[1], 'guest', 'guest', '1.0', '/'),
    deferred = q.defer(),
    self = this;

  message.clientId = uuid.v1();
  self.subscribedRooms[message.clientId] = {};

  publish.call(self, topic, message)
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
