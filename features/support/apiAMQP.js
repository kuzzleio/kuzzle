var
  _ = require('lodash'),
  config = require('./config')(),
  amqp = require('amqplib'),
  q = require('q'),
  uuid = require('node-uuid'),
  KUZZLE_EXCHANGE = 'amq.topic',
  ApiRT = require('./apiRT');

/** CONSTRUCT **/
var ApiAMQP = function () {
  this.amqpClient = null;
  this.amqpChannel = null;

  ApiRT.call(this);
};
ApiAMQP.prototype = new ApiRT();

/** SPECIFIC FOR AMQP */
ApiAMQP.prototype.init = function (world) {
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
};

ApiAMQP.prototype.disconnect = function () {
  if (this.amqpClient) {
    this.amqpClient.then( function (connection) {
        connection.close();
      })
      .catch();

    this.amqpClient = null;
    this.amqpChannel = null;
  }
};

ApiAMQP.prototype.send = function (message, waitForAnswer) {
  var
    deferred = q.defer(),
    topic = 'kuzzle',
    listen = (waitForAnswer !== undefined) ? waitForAnswer : true;

  if (!message.clientId) {
    message.clientId = this.clientId;
  }

  message.metadata = this.world.metadata;

  if (this.world.currentUser && this.world.currentUser.token) {
    if (!message.headers) {
      message.headers = {};
    }
    message.headers = _.extend(message.headers, {authorization: 'Bearer ' + this.world.currentUser.token});
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
                unpacked.error.statusCode = unpacked.status;
                deferred.reject(unpacked.error);
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

ApiAMQP.prototype.sendAndListen = function (message) {
  var
    deferred = q.defer();

  message.clientId = uuid.v1();
  this.subscribedRooms[message.clientId] = {};

  this.send.call(this, message)
    .then(response => {
      this.amqpClient.then(connection => { return connection.createChannel(); })
      .then(channel => {
        this.subscribedRooms[message.clientId][response.result.roomId] = channel;

        channel.assertQueue(response.result.channel)
          .then(() => { return channel.bindQueue(response.result.channel, KUZZLE_EXCHANGE, response.result.channel); })
          .then(() => {
            channel.consume(response.result.channel, reply => {
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


module.exports = ApiAMQP;
