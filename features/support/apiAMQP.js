var
  config = require('./config')(),
  amqp = require('amqplib'),
  q = require('q'),
  uuid = require('node-uuid'),
  KUZZLE_EXCHANGE = 'amq.topic';

module.exports = {
  world: null,
  clientId: null,
  amqpClient: null,
  amqpChannel: null,
  subscribedRooms: {},
  responses: null,

  init: function (world) {
    this.world = world;
    this.responses = null;
    this.clientId = uuid.v1();
    this.subscribedRooms = {};

    if (!this.amqpClient) {
      this.amqpClient = amqp.connect(config.amqpUrl);
      this.amqpChannel = this.amqpClient.then(function (connection) {
        return connection.createChannel();
      });
    }
  },

  disconnect: function () {
    if (this.amqpClient) {
      this.amqpClient
        .then(function (connection) {
          connection.close();
        })
        .catch();

      this.amqpClient = null;
      this.amqpChannel = null;
    }

    return Promise.resolve();
  },

  create: function (body, persist) {
    var
      msg = {
        controller: 'write',
        collection: this.world.fakeCollection,
        index: this.world.fakeIndex,
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
        index: this.world.fakeIndex,
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
        index: this.world.fakeIndex,
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
        index: this.world.fakeIndex,
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
        index: this.world.fakeIndex,
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
        index: this.world.fakeIndex,
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
        index: this.world.fakeIndex,
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
        index: this.world.fakeIndex,
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
        index: this.world.fakeIndex,
        action: 'deleteCollection'
      };

    return publish.call(this, msg);
  },

  deleteIndexes: function () {
    var
      msg = {
        controller: 'admin',
        index: this.world.fakeIndex,
        action: 'deleteIndexes'
      };

    return publish.call(this, msg);
  },

  putMapping: function () {
    var
      msg = {
        controller: 'admin',
        collection: this.world.fakeCollection,
        index: this.world.fakeIndex,
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
        index: this.world.fakeIndex,
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
        index: this.world.fakeIndex,
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
        index: this.world.fakeIndex,
        action: 'off',
        body: { roomId: room }
      };

    this.subscribedRooms[clientId][room].close();
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
        index: this.world.fakeIndex,
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
        index: this.world.fakeIndex,
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
    listen = (waitForAnswer !== undefined) ? waitForAnswer : true;

  if (!message.clientId) {
    message.clientId = this.clientId;
  }

  message.metadata = this.world.metadata;

  this.amqpChannel.then(channel => {
    if (listen) {
      channel.assertQueue(null, {autoDelete: true, exclusive: true, durable: false})
        .then(queue => {
          channel.consume(queue.queue, reply => {
            channel.ack(reply);
            channel.cancel(reply.fields.consumerTag).then(() => {
              var unpacked = JSON.parse((new Buffer(reply.content)).toString());

              if (unpacked.error) {
                deferred.reject(unpacked.error.message);
              }
              else {
                deferred.resolve(unpacked);
              }
            });
          })
          .then(() => {
            channel.publish(KUZZLE_EXCHANGE, topic, new Buffer(JSON.stringify(message)), { replyTo: queue.queue });
          });
        })
        .catch(error => deferred.reject(error.message));
    }
    else {
      channel.publish(KUZZLE_EXCHANGE, topic, new Buffer(JSON.stringify(message)));
      deferred.resolve({});
    }
  });

  return deferred.promise;
};

var publishAndListen = function (message) {
  var
    deferred = q.defer();

  message.clientId = uuid.v1();
  this.subscribedRooms[message.clientId] = {};

  publish.call(this, message)
    .then(response => {
      this.amqpClient.then(connection => { return connection.createChannel(); })
      .then(channel => {
        this.subscribedRooms[message.clientId][response.result.roomId] = channel;

        channel.assertQueue(response.result.roomId)
          .then(() => { return channel.bindQueue(response.result.roomId, KUZZLE_EXCHANGE, response.result.roomId); })
          .then(() => {
            channel.consume(response.result.roomId, reply => {
              var notification = JSON.parse((new Buffer(reply.content)).toString());
              channel.ack(reply);
              this.responses = notification;
            });
          })
          .then(() => { deferred.resolve(response); });
      });
    })
    .catch(error => deferred.reject(new Error(error.message)));

  return deferred.promise;
};
