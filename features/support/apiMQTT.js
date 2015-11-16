var
  config = require('./config')(),
  mqtt = require('mqtt'),
  uuid = require('node-uuid'),
  q = require('q');

module.exports = {
  world: null,
  mqttClient: null,
  subscribedRooms: null,
  responses: null,

  init: function (world) {
    this.world = world;
    this.responses = null;
    this.subscribedRooms = {};

    if (this.mqttClient) {
      return false;
    }

    this.mqttClient = mqtt.connect(config.mqttUrl);
    this.mqttClient.subscribe('mqtt.' + this.mqttClient.options.clientId);
  },

  disconnect: function () {
    if (this.mqttClient) {
      this.mqttClient.end(true);
      this.mqttClient = null;
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

    this.subscribedRooms[clientId][room].end(true);
    delete this.subscribedRooms[clientId];
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

  getStats: function () {
    var
      msg = {
        controller: 'admin',
        action: 'getStats'
      };

    return publish.call(this, msg);
  },

  getAllStats: function () {
    var
      msg = {
        controller: 'admin',
        action: 'getStats'
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
  }
};

var publish = function (message, waitForAnswer) {
  var
    deferred = q.defer(),
    topic = 'kuzzle',
    listen = (waitForAnswer !== undefined) ? waitForAnswer : true;

  if (!message.clientId) {
    message.clientId = this.mqttClient.options.clientId;
  }

  message.metadata = this.world.metadata;

  if (listen) {
    this.mqttClient.once('message', function (topic, message) {
      var unpacked = JSON.parse((new Buffer(message)).toString());

      if (unpacked.error) {
        deferred.reject(unpacked.error);
      }
      else {
        deferred.resolve(unpacked);
      }
    }.bind(this));
  }
  else {
    deferred.resolve({});
  }

  this.mqttClient.publish(topic, JSON.stringify(message));

  return deferred.promise;
};

var publishAndListen = function (message) {
  var
    deferred = q.defer(),
    topic = 'kuzzle',
    mqttListener = mqtt.connect(config.mqttUrl);

  message.clientId = mqttListener.options.clientId;
  message.metadata = this.world.metadata;
  this.subscribedRooms[message.clientId] = {};
  mqttListener.subscribe('mqtt.' + mqttListener.options.clientId);

  mqttListener.once('message', function (topic, response) {
    var unpacked = JSON.parse((new Buffer(response)).toString());

    if (unpacked.error) {
      mqttListener.end(true);
      deferred.reject(unpacked.error);
      return false;
    }

    mqttListener.on('message', function (topic, notification) {
      this.responses = JSON.parse((new Buffer(notification)).toString());
    }.bind(this));

    mqttListener.subscribe(unpacked.result.roomId);
    this.subscribedRooms[message.clientId][unpacked.result.roomId] = mqttListener;
    deferred.resolve(unpacked);
  }.bind(this));

  mqttListener.publish(topic, JSON.stringify(message));
  return deferred.promise;
};
