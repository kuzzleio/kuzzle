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

    this.clientId = uuid.v1();

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
        clientId: this.subscribedRooms[room].clientId,
        requestId: room
      };

    this.subscribedRooms[room].listener.close();
    delete this.subscribedRooms[room];
    return publish.call(this, topic, msg, false);
  },

  countSubscription: function () {
    var
      topic = ['subscribe', this.world.fakeCollection, 'count'].join('.'),
      rooms = Object.keys(this.subscribedRooms),
      msg = {
        body: {
          roomId: this.subscribedRooms[rooms[0]].roomId
        }
      };

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

  this.amqpChannel.then(function (channel) {
    if (listen) {
      channel.assertQueue(null, {autoDelete: true, exclusive: true, durable: false})
        .then(function (queue) {
          channel.consume(queue.queue, function (reply) {
            channel.ack(reply);
            channel.cancel(reply.fields.consumerTag).then(function () {
              var unpacked = JSON.parse((new Buffer(reply.content)).toString());

              if (unpacked.error) {
                deferred.reject(unpacked.error);
              }
              else {
                deferred.resolve(unpacked);
              }
            });
          })
          .then(function () {
            channel.publish(KUZZLE_EXCHANGE, topic, new Buffer(JSON.stringify(message)), { replyTo: queue.queue });
          });
        })
        .catch(function (error) {
          deferred.reject(new Error(error));
        });
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

  publish.call(this, topic, message).then(function (response) {
    this.amqpClient.then(function (connection) {
      connection.createChannel().then(function (channel) {
        this.subscribedRooms[response.result.roomName] = { roomId: response.result.roomId, clientId: message.clientId, listener: channel };

        channel.assertQueue(response.result.roomId)
          .then(function () {
            return channel.bindQueue(response.result.roomId, KUZZLE_EXCHANGE, response.result.roomId);
          })
          .then(function () {
            channel.consume(response.result.roomId, function (reply) {
              var notification = JSON.parse((new Buffer(reply.content)).toString());
              channel.ack(reply);
              this.responses = notification;
            }.bind(this));
          }.bind(this))
          .then(function () {
            deferred.resolve(response);
          });
      }.bind(this))
        .catch(function (error) {
          deferred.reject(new Error(error));
        });
    }.bind(this));
  }.bind(this))
  .catch(function (error) {
    deferred.reject(new Error(error));
  });

  return deferred.promise;
};
