var
  _ = require('lodash'),
  config = require('./config')(),
  amqp = require('amqplib'),
  Promise = require('bluebird'),
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
  this.clientId = uuid.v4();
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
    this.amqpClient.then(function (connection) {
      connection.close();
    })
      .catch();

    this.amqpClient = null;
    this.amqpChannel = null;
  }
};

ApiAMQP.prototype.send = function (message, waitForAnswer) {
  var
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

  return this.amqpChannel.then(channel => {
    if (listen) {
      return channel.assertQueue(null, {autoDelete: true, exclusive: true, durable: false})
        .then(queue => {
          return channel.consume(queue.queue, reply => {
            channel.ack(reply);
            channel.cancel(reply.fields.consumerTag).then(() => {
              var unpacked = JSON.parse((new Buffer(reply.content)).toString());

              if (unpacked.error) {
                unpacked.error.statusCode = unpacked.status;
                return Promise.reject(unpacked.error);
              }

              return unpacked;
            });
          })
          .then(() => {
            return channel.publish(KUZZLE_EXCHANGE, topic, new Buffer(JSON.stringify(message)), {replyTo: queue.queue});
          });
        })
        .catch(error => Promise.reject(error.message));
    }

    return channel.publish(KUZZLE_EXCHANGE, topic, new Buffer(JSON.stringify(message)));
  });
};

ApiAMQP.prototype.sendAndListen = function (message) {
  var
    sendResponse,
    channel;

  message.clientId = uuid.v4();
  this.subscribedRooms[message.clientId] = {};

  return this.send(message)
    .then(response => {
      sendResponse = response;
      return this.amqpClient.then(connection => connection.createChannel());
    })
    .then(response => {
      channel = response;
      this.subscribedRooms[message.clientId][sendResponse.result.roomId] = channel;
      return channel.assertQueue(sendResponse.result.channel);
    })
    .then(() => channel.bindQueue(sendResponse.result.channel, KUZZLE_EXCHANGE, sendResponse.result.channel))
    .then(() => {
      channel.consume(sendResponse.result.channel, reply => {
        var notification = JSON.parse((new Buffer(reply.content)).toString());
        channel.ack(reply);
        this.responses = notification;
      });

      return sendResponse;
    })
    .catch(error => Promise.reject(new Error(error.message)));
};

module.exports = ApiAMQP;
