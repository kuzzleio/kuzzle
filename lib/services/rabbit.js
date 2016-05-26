var
  InternalError = require('../api/core/errors/internalError'),
  ServiceUnavailableError = require('../api/core/errors/serviceUnavailableError'),
  stringify = require('json-stable-stringify'),
  amqp = require('amqplib'),
  util = require('util'),
  Service = require('./service'),
  q = require('q'),
  // AMQP management variables
  amqpConnection,
  amqpMainChannel,
  amqpDomain = require('domain').create(),
  // Default AMQP exchange name. Constant.
  AMQ_EXCHANGE = 'amq.topic';

function RabbitMQ (kuzzle, options) {
  this.kuzzleConfig = kuzzle.config;
  this.enabled = false;
  this.listeners = {};

  Object.defineProperties(this, {
    settings: {
      writable: true,
      value: {
        service: options.service
      }
    }
  });

  /**
   * Initialize the connection with the amqp broker
   */
  this.init = function () {
    if (process.env.MQ_BROKER_ENABLED) {
      this.toggle(process.env.MQ_BROKER_ENABLED === '1');
    }
    else {
      this.toggle(this.kuzzleConfig.mqBroker.enabled);
    }

    amqpDomain.on('error', this.onErrorRestart.bind(this));

    return q(this);
  };

  /**
   * Enable or disable this service.
   * If disabled, all listen* actions (past and future) are bufferized and replayed if the service is enabled.
   *
   * @param {boolean} toggle true/false to enable/disable
   * @return {Promise}
   */
  this.toggle = function (toggle) {
    var
      deferred,
      self = this;

    if (toggle === self.enabled) {
      return q.reject(new InternalError('RabbitMQ service is already ' + (toggle ? 'enabled' : 'disabled')));
    }

    deferred = q.defer();
    self.enabled = toggle;

    if (toggle) {
      amqpConnection = amqp.connect('amqp://' + self.kuzzleConfig.mqBroker.host + ':' + self.kuzzleConfig.mqBroker.port);

      amqpConnection
        .then(function (connection) {
          amqpDomain.add(connection);
          amqpMainChannel = connection.createChannel();

          // Register bufferized listeners
          Object.keys(self.listeners).forEach(function (room) {
            var listener = self.listeners[room];
            self[listener.type](room, listener.callback);
          });

          kuzzle.pluginsManager.trigger('rabbit:started', 'RabbitMQ Service started');
          deferred.resolve('RabbitMQ Service started');
        })
        .catch(function (error) {
          kuzzle.pluginsManager.trigger('log:error',
            'Unable to contact the RabbitMQ server: ' + error.message + ' ' +
            'Check that it is running and the connection URL'
          );
          kuzzle.pluginsManager.trigger('rabbit:error',error);

          deferred.reject(new ServiceUnavailableError('Unable to contact the RabbitMQ server: ' + error.message));
        });
    }
    else {
      self.close();

      kuzzle.pluginsManager.trigger('rabbit:stopped', 'RabbitMQ Service stopped');
      deferred.resolve('RabbitMQ Service stopped');
    }

    return deferred.promise;
  };

  /**
   * Sends data to a room
   * @param room
   * @param data object that must be insert in queue
   */
  this.add = function (room, data) {
    if (!this.enabled || !room) {
      kuzzle.pluginsManager.trigger('log:warn', 'AMQP service disabled => discarded message to room ' + room);
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
        kuzzle.pluginsManager.trigger('log:error', error);
      });
  };

  /**
   * Allow to add an object to a specific exchange/routing_key
   * @param routingKey
   * @param data object that must be insert into routing key
   */
  this.addExchange = function (routingKey, data) {
    if (!this.enabled) {
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
        kuzzle.pluginsManager.trigger('log:error', error);
      });
  };

  /**
   * Sends a reply to a room
   * @param room
   * @param data object that must be insert into routing key
   */
  this.replyTo = function (room, data) {
    if (!this.enabled) {
      kuzzle.pluginsManager.trigger('log:warn', 'AMQP service disabled => discarded message to room ' + room);
      return false;
    }

    waitForMainChannel()
      .then(function(channel) {
        channel.sendToQueue(room, new Buffer(stringify(data)), {deliveryMode: true});
      });
  };

  /**
   * Listen a specific room and execute a callback for each messages
   *
   * @param {String} room
   * @param {Function} onListenCB called each times a message is received
   */
  this.listen = function (room, onListenCB) {
    var self = this;

    if (!self.listeners[room]) {
      self.listeners[room] = { type: 'listen', callback: onListenCB, active: false };
    }

    if (!self.enabled || this.listeners[room].active) {
      return false;
    }

    self.listeners[room].active = true;

    amqpConnection.then(function (conn) {
      return conn.createChannel().then(function (channel) {
        return channel.assertQueue(room, {durable: true})
          .then(function () {
            channel.prefetch(1);
          })
          .then(function () {
            channel.consume(room, function (msg) {
              var parsedContent;

              channel.ack(msg);

              try {
                parsedContent = JSON.parse(msg.content.toString());
              }
              catch (e) {
                kuzzle.pluginsManager.trigger('log:error', e);
                return false;
              }

              onListenCB(parsedContent);
            });
          })
          .catch(function (error) {
            kuzzle.pluginsManager.trigger('log:error', error);
          });
      });
    });
  };

  /**
   * Listen to a specific room and execute a callback once a message is received
   *
   * @param {String} room
   * @param {Function} onListenCB called each times a message is received
   */
  this.listenOnce = function (room, onListenCB) {
    var self = this;

    if (!self.listeners[room]) {
      self.listeners[room] = { type: 'listenOnce', callback: onListenCB, active: false };
    }

    if (!self.enabled || self.listeners[room].active) {
      return false;
    }

    self.listeners[room].active = true;

    amqpConnection.then(function (conn) {
      return conn.createChannel().then(function (channel) {
        return channel.assertQueue(room)
          .then(function () {
            channel.prefetch(1);
          })
          .then(function () {
            channel.consume(room, function (msg) {
              var parsedContent;

              try {
                channel.ack(msg);
                parsedContent = JSON.parse(msg.content.toString());
                onListenCB(parsedContent);
              }
              catch (e) {
                kuzzle.pluginsManager.trigger('log:error', e);
                return false;
              }
              finally {
                channel.close();
              }
            });
          })
          .catch(function (error) {
            kuzzle.pluginsManager.trigger('log:error', error);
          });
      });
    });
  };

  /**
   * Listen an exchange to a specific routing key and execute a callback for each message
   *
   * @param routingKey
   * @param onListenCB called each times a message is received
   */
  this.listenExchange = function (routingKey, onListenCB) {
    var self = this;

    if (!self.listeners[routingKey]) {
      self.listeners[routingKey] = { type: 'listenExchange', callback: onListenCB, active: false };
    }

    if (!self.enabled || self.listeners[routingKey].active) {
      return false;
    }

    self.listeners[routingKey].active = true;

    amqpConnection.then(function (conn) {
      return conn.createChannel().then(function (channel) {
        self.listeners[routingKey].channel = channel;

        return channel.assertExchange(AMQ_EXCHANGE, 'topic', {durable: true})
          .then(function () {
            return channel.assertQueue('', {exclusive: true});
          })
          .then(function (qok) {
            var queue = qok.queue;
            channel.bindQueue(queue, AMQ_EXCHANGE, routingKey);
            channel.consume(queue, function (msg) {
              onListenCB(msg);
            });
          })
          .catch(function (error) {
            kuzzle.pluginsManager.trigger('log:error', error);
          });
      });
    });
  };

  /**
   * Shutdown the connection to RabbitMQ
   */
  this.close = function () {
    // Marking all registered listeners as deactivated
    Object.keys(this.listeners).forEach(function (room) {
      this.listeners[room].active = false;
      this.listeners[room].channel.close();
    }.bind(this));

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
  };

  /**
   * Broker Error: now the AMQP connection is either closed or in a very bad shape.
   * Two options:
   *    - Restart the connection, hoping we didn't lose too many data
   *    - Panic
   *
   * Here is the implementation for the 1st option.
   */
  this.onErrorRestart = function () {
    kuzzle.pluginsManager.trigger('log:error', 'Catched an error from the AMQP broker service. Restarting connection...');

    // Marking all registered listeners as deactivated
    Object.keys(this.listeners).forEach(function (room) {
      this.listeners[room].active = false;
      this.listeners[room].channel.close();
    }.bind(this));

    // Trying to close the connection cleanly.
    if (amqpConnection) {
      amqpDomain.remove(amqpConnection);
      amqpConnection.
        then(function(connection) {
          connection.close();
        })
        .catch(function (error) {
          kuzzle.pluginsManager.trigger('log:error', error);
        });

      amqpConnection = null;
    }

    this.init();
  };
}

util.inherits(RabbitMQ, Service);

module.exports = RabbitMQ;

function waitForMainChannel () {
  var
    deferred = q.defer(),
    checking;

  if (amqpMainChannel) {
    deferred.resolve(amqpMainChannel);
  }
  else {
    checking = setTimeout(function() {
      if (amqpMainChannel) {
        clearTimeout(checking);
        deferred.resolve(amqpMainChannel);
      }
    }, 50);
  }

  return deferred.promise;
}
