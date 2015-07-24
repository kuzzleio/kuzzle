var
  stringify = require('json-stable-stringify'),
  amqp = require('amqplib'),
  captainsLog = require('captains-log'),
  // AMQP management variables
  amqpConnection,
  amqpMainChannel,
  amqpDomain = require('domain').create(),
  // Default AMQP exchange name. Constant.
  AMQ_EXCHANGE = 'amq.topic';

module.exports = broker =  {
  kuzzleConfig: null,
  log: captainsLog(),

  /**
   * Initialize the connection with the amqp broker
   * @param kuzzleConfig
   */
  init: function (kuzzleConfig) {
    if (amqpConnection) {
      return false;
    }

    amqpDomain.on('error', this.onErrorRestart);
    amqpConnection = amqp.connect('amqp://' + kuzzleConfig.mqBroker.host);

    amqpConnection
      .then(function (connection) {
        amqpDomain.add(connection);
        amqpMainChannel = connection.createChannel();
      });

    broker.kuzzleConfig = kuzzleConfig;
  },

  /**
   * Sends data to a room
   * @param room
   * @param data object that must be insert in queue
   */
  add: function (room, data) {
    if (!room) {
      return false;
    }

    amqpMainChannel
      .then(function (channel) {
        channel.assertQueue(room, {durable: true})
          .then(function () {
            channel.sendToQueue(room, new Buffer(stringify(data)), {deliveryMode: true});
          });
      })
      .catch(function (error) {
        broker.log.error(new Error(error));
      });
  },

  /**
   * Allow to add an object to a specific exchange/routing_key
   * @param routingKey
   * @param data object that must be insert into routing key
   */
  addExchange: function (routingKey, data) {
    amqpMainChannel
      .then(function (channel) {
        return channel.assertExchange(AMQ_EXCHANGE, 'topic', {durable: true})
          .then(function () {
            return channel.publish(AMQ_EXCHANGE, routingKey, new Buffer(stringify(data)), {deliveryMode: true});
          });
      })
      .catch(function (error) {
        broker.log.error(new Error(error));
      });
  },

  /**
   * Sends a reply to a room
   * @param room
   * @param data object that must be insert into routing key
   */
  replyTo: function (room, data) {
    amqpMainChannel
      .then(function(channel) {
        channel.sendToQueue(room, new Buffer(stringify(data)), {deliveryMode: true});
      });
  },

  /**
   * Listen a specific room and execute a callback for each messages
   *
   * @param {String} room
   * @param {Function} onListenCB called each times a message is received
   * @returns promise
   */
  listen: function (room, onListenCB) {
    amqpConnection.then(function (conn) {
      return conn.createChannel().then(function (channel) {
        return channel.assertQueue(room, {durable: true})
          .then(function () {
            channel.prefetch(1);
          })
          .then(function () {
            channel.consume(room, function doWork (msg) {
              var parsedContent;

              channel.ack(msg);

              try {
                  parsedContent = JSON.parse(msg.content.toString());
              }
              catch(e) {
                broker.log.error('Parse error: ', e.message, '\nIncriminated message: ', msg);
                return false;
              }

              onListenCB(parsedContent);
            });
          })
          .catch(function (error) {
            broker.log.error(new Error(error));
          });
      });
    });
  },

  /**
   * Listen to a specific room and execute a callback once a message is received
   *
   * @param {String} room
   * @param {Function} onListenCB called each times a message is received
   * @returns promise
   */
  listenOnce: function (room, onListenCB) {
    amqpConnection.then(function (conn) {
      return conn.createChannel().then(function (channel) {
        return channel.assertQueue(room, {durable: true})
          .then(function () {
            channel.prefetch(1);
          })
          .then(function () {
            channel.consume(room, function doWork (msg) {
              var parsedContent;

              try {
                channel.ack(msg);
                parsedContent = JSON.parse(msg.content.toString());
                onListenCB(parsedContent);
              }
              catch(e) {
                broker.log.error('Parse error: ', e.message, '\nIncriminated message: ', msg);
                return false;
              }
              finally {
                channel.close();
              }
            });
          })
          .catch(function (error) {
            broker.log.error(new Error(error));
          });
      });
    });
  },

  /**
   * Listen an exchange to a specific routing key and execute a callback for each message
   *
   * @param routingKey
   * @param onListenCB called each times a message is received
   * @returns promise
   */
  listenExchange: function (routingKey, onListenCB) {
    amqpConnection.then(function (conn) {
      return conn.createChannel().then(function (channel) {
        return channel.assertExchange(AMQ_EXCHANGE, 'topic', {durable: true})
          .then(function () {
            return channel.assertQueue('', {exclusive: true});
          })
          .then(function (qok) {
            var queue = qok.queue;
            channel.bindQueue(queue, AMQ_EXCHANGE, routingKey);
            channel.consume(queue, function doWork (msg) {
              onListenCB(msg);
            });
          })
          .catch(function (error) {
            broker.log.error(new Error(error));
          });
      });
    });
  },

  close: function () {
    amqpConnection.then(function (conn) {
      process.once('SIGINT', function () {
        conn.close();
      });
    });
  },

  /**
   * Broker Error: now the AMQP connection is either closed or in a very bad shape.
   * Two options:
   *    - Restart the connection, hoping we didn't lose too many data
   *    - Panic
   *
   * Here is the implementation for the 1st option.
   */
  onErrorRestart: function () {
    broker.log.error('Catched an error from the AMQP broker service. Restarting connection...');

    // Trying to close the connection cleanly.
    if (amqpConnection) {
      amqpDomain.remove(amqpConnection);
      amqpConnection.
        then(function(connection) {
          connection.close();
        })
        .catch(function (error) {
          broker.log.error(new Error(error));
        });

      amqpConnection = null;
    }

    broker.init(broker.kuzzleConfig);
  }
};
