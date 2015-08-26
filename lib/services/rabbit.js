var
  stringify = require('json-stable-stringify'),
  amqp = require('amqplib'),
  q = require('q'),
  captainsLog = require('captains-log'),
  // AMQP management variables
  amqpConnection,
  amqpMainChannel,
  amqpDomain = require('domain').create(),
  // Default AMQP exchange name. Constant.
  AMQ_EXCHANGE = 'amq.topic';

module.exports = rabbit =  {
  kuzzleConfig: null,
  log: captainsLog(),
  enabled: false,
  listeners: {},

  /**
   * Initialize the connection with the amqp broker
   * @param kuzzleConfig
   */
  init: function (kuzzleConfig) {
    rabbit.kuzzleConfig = kuzzleConfig;

    if (process.env.MQ_BROKER_ENABLED) {
      rabbit.toggle(process.env.MQ_BROKER_ENABLED === '1');
    }
    else {
      rabbit.toggle(rabbit.kuzzleConfig.mqBroker.enabled);
    }

    amqpDomain.on('error', this.onErrorRestart);
  },

  /**
   * Enable or disable this service.
   * If disabled, all listen* actions (past and future) are bufferized and replayed if the service is enabled.
   *
   * @param {boolean} toggle true/false to enable/disable
   * @return {Promise}
   */
  toggle: function (toggle) {
    var deferred;

    if (toggle === rabbit.enabled) {
      return Promise.reject('RabbitMQ service is already ' + (toggle ? 'enabled' : 'disabled'));
    }

    deferred = q.defer();
    rabbit.enabled = toggle;

    if (toggle) {
      amqpConnection = amqp.connect('amqp://' + rabbit.kuzzleConfig.mqBroker.host + ':' + rabbit.kuzzleConfig.mqBroker.port);

      amqpConnection
        .then(function (connection) {
          amqpDomain.add(connection);
          amqpMainChannel = connection.createChannel();

          // Register bufferized listeners
          Object.keys(rabbit.listeners).forEach(function (room) {
            var listener = rabbit.listeners[room];
            rabbit[listener.type](room, listener.callback);
          });

          rabbit.log.info('RabbitMQ Service started');
          deferred.resolve('RabbitMQ Service started');
        })
        .catch(function (error) {
          rabbit.log.error('Unable to contact the RabbitMQ server: ', error.message);
          rabbit.log.error('Check that it is running and the connection URL');
          deferred.reject('Unable to contact the RabbitMQ server: ' + error.message);
        });
    }
    else {
      rabbit.close();
      rabbit.log.info('RabbitMQ Service stopped');
      deferred.resolve('RabbitMQ Service stopped');
    }

    return deferred.promise;
  },

  /**
   * Sends data to a room
   * @param room
   * @param data object that must be insert in queue
   */
  add: function (room, data) {
    if (!rabbit.enabled || !room) {
      rabbit.log.warn('AMQP service disabled => discarded message to room ', room);
      return false;
    }

    waitForMainChannel()
      .then(function (channel) {
        channel.assertQueue(room, {durable: true})
          .then(function () {
            channel.sendToQueue(room, new Buffer(stringify(data)), {deliveryMode: true});
          });
      })
      .catch(function (error) {
        rabbit.log.error(new Error(error));
      });
  },

  /**
   * Allow to add an object to a specific exchange/routing_key
   * @param routingKey
   * @param data object that must be insert into routing key
   */
  addExchange: function (routingKey, data) {
    if (!rabbit.enabled) {
      return false;
    }

    waitForMainChannel()
      .then(function (channel) {
        return channel.assertExchange(AMQ_EXCHANGE, 'topic', {durable: true})
          .then(function () {
            return channel.publish(AMQ_EXCHANGE, routingKey, new Buffer(stringify(data)), {deliveryMode: true});
          });
      })
      .catch(function (error) {
        rabbit.log.error(new Error(error));
      });
  },

  /**
   * Sends a reply to a room
   * @param room
   * @param data object that must be insert into routing key
   */
  replyTo: function (room, data) {
    if (!rabbit.enabled) {
      rabbit.log.warn('AMQP service disabled => discarded message to room  ', room);
      return false;
    }

    waitForMainChannel()
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
    if (!rabbit.enabled || (rabbit.listeners[routingKey] && rabbit.listeners[routingKey].active)) {
      return false;
    }

    if (!rabbit.listeners[routingKey]) {
      rabbit.listeners[routingKey] = { type: 'listenExchange', callback: onListenCB, active: rabbit.enabled };
    }

    rabbit.listeners[routingKey].active = true;

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
                rabbit.log.error('Parse error: ', e.message, '\nIncriminated message: ', msg);
                return false;
              }

              onListenCB(parsedContent);
            });
          })
          .catch(function (error) {
            rabbit.log.error(new Error(error));
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
    if (!rabbit.enabled || (rabbit.listeners[routingKey] && rabbit.listeners[routingKey].active)) {
      return false;
    }

    if (!rabbit.listeners[routingKey]) {
      rabbit.listeners[routingKey] = { type: 'listenExchange', callback: onListenCB, active: rabbit.enabled };
    }

    rabbit.listeners[routingKey].active = true;

    amqpConnection.then(function (conn) {
      return conn.createChannel().then(function (channel) {
        return channel.assertQueue(room)
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
                rabbit.log.error('Parse error: ', e.message, '\nIncriminated message: ', msg);
                return false;
              }
              finally {
                channel.close();
              }
            });
          })
          .catch(function (error) {
            rabbit.log.error(new Error(error));
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
    if (!rabbit.enabled || (rabbit.listeners[routingKey] && rabbit.listeners[routingKey].active)) {
      return false;
    }

    if (!rabbit.listeners[routingKey]) {
      rabbit.listeners[routingKey] = { type: 'listenExchange', callback: onListenCB, active: rabbit.enabled };
    }

    rabbit.listeners[routingKey].active = true;

    amqpConnection.then(function (conn) {
      return conn.createChannel().then(function (channel) {
        rabbit.listeners[routingKey].channel = channel;

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
            rabbit.log.error(new Error(error));
          });
      });
    });
  },

  /**
   * Shutdown the connection to RabbitMQ
   */
  close: function () {
    // Marking all registered listeners as deactivated
    Object.keys(rabbit.listeners).forEach(function (room) {
      rabbit.listeners[room].active = false;
      rabbit.listeners[room].channel.close();
    });

    if (amqpConnection) {
      amqpConnection.then(function (conn) {
        process.once('SIGINT', function () {
          amqpDomain.remove(conn);
          conn.close();
          amqpConnection = null;
          amqpMainChannel = null;
        });
      });
    }
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
    rabbit.log.error('Catched an error from the AMQP broker service. Restarting connection...');

    // Marking all registered listeners as deactivated
    Object.keys(rabbit.listeners).forEach(function (room) {
      rabbit.listeners[room].active = false;
      rabbit.listeners[room].channel.close();
    });

    // Trying to close the connection cleanly.
    if (amqpConnection) {
      amqpDomain.remove(amqpConnection);
      amqpConnection.
        then(function(connection) {
          connection.close();
        })
        .catch(function (error) {
          rabbit.log.error(new Error(error));
        });

      amqpConnection = null;
    }

    rabbit.init(rabbit.kuzzleConfig);
  }
};

function waitForMainChannel () {
  var deferred = q.defer();

  if (amqpMainChannel) {
    deferred.resolve(amqpMainChannel);
  }
  else {
    var checking = setTimeout(function() {
      if (amqpMainChannel) {
        clearTimeout(checking);
        deferred.resolve(amqpChannel);
      }
    }, 50);
  }

  return deferred.promise;
}
