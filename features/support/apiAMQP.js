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
      this.amqpClient.then( function (connection) {
          connection.close();
        })
        .catch();

      this.amqpClient = null;
      this.amqpChannel = null;
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

  count: function (filters) {
    var
      topic = ['read', this.world.fakeCollection, 'count'].join('.'),
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
        clientId: clientId,
        body: { roomId: room }
      };

    this.subscribedRooms[clientId][room].close();
    delete this.subscribedRooms[clientId];

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
    listen = (waitForAnswer !== undefined) ? waitForAnswer : true;

  if ( !message.clientId ) {
    message.clientId = this.clientId;
  }

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

var publishAndListen = function (topic, message) {
  var
    deferred = q.defer();

  message.clientId = uuid.v1();
  this.subscribedRooms[message.clientId] = {};

  publish.call(this, topic, message)
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
