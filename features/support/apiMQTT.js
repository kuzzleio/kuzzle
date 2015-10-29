var
  config = require('./config')(),
  mqtt = require('mqtt'),
  uuid = require('node-uuid'),
  q = require('q');

module.exports = {
  world: null,
  mqttClient: null,
  subscribedRooms: {client1: {}},
  responses: null,

  init: function (world) {
    this.world = world;
    this.responses = null;

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

  unsubscribe: function (room) {
    var
      topic = ['subscribe', this.world.fakeCollection, 'off'].join('.'),
      msg = {
        clientId: this.subscribedRooms.client1[room].listener.options.clientId,
        requestId: room
      };

    this.subscribedRooms.client1[room].listener.end(true);
    delete this.subscribedRooms.client1[room];
    return publish.call(this, topic, msg, false);
  },

  countSubscription: function () {
    var
      topic = ['subscribe', this.world.fakeCollection, 'count'].join('.'),
      rooms = Object.keys(this.subscribedRooms.client1),
      msg = {
        body: {
          roomId: this.subscribedRooms.client1[rooms[0]].roomId
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
    listen = (waitForAnswer === undefined) ? true : waitForAnswer;

  if (!message.clientId) {
    message.clientId = this.mqttClient.options.clientId;
  }

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

var publishAndListen = function (topic, message) {
  var
    deferred = q.defer(),
    mqttListener = mqtt.connect(config.mqttUrl);

  message.requestId = uuid.v1();
  message.clientId = mqttListener.options.clientId;
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
    this.subscribedRooms.client1[message.requestId] = { roomId: unpacked.result.roomId, listener: mqttListener };
    deferred.resolve(unpacked);
  }.bind(this));

  mqttListener.publish(topic, JSON.stringify(message));
  return deferred.promise;
};
