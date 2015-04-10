var
// Main library for manipulate amqp protocol like RabbitMQ
  amqp = require('amqplib'),
// Promise created by amqplib for handle amqp connection
  pConnection;

module.exports = {

  /**
   * Initialize the connection with the amqp broker
   * @param kuzzle
   * @returns {boolean}
   */
  init: function (kuzzle) {
    if (pConnection) {
      return false;
    }
    pConnection = amqp.connect('amqp://' + kuzzle.config.broker.host);
  },

  /**
   * Allow to add an object in a specific room.
   * @param room
   * @param data object that must be insert in queue
   */
  add: function (room, data) {
    pConnection.then(function (conn) {
      return conn.createChannel()
        .then(function (ch) {
          ch.assertQueue(room, {durable: true});
          ch.sendToQueue(room, new Buffer(JSON.stringify(data)), {deliveryMode: true});
        });
    });
  },

  /**
   * Listen a specific room and execute a callback for each messages
   *
   * @param room
   * @param onListenCB called each times a message is received
   * @returns promise
   */
  listen: function (room, onListenCB) {
    pConnection.then(function (conn) {
      return conn.createChannel().then(function (channel) {
        return channel.assertQueue(room, {durable: true})
          .then(function () {
            channel.prefetch(1);
          })
          .then(function () {
            channel.consume(room, function doWork (msg) {
              channel.ack(msg);
              onListenCB(JSON.parse(msg.content.toString()));
            });
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
    pConnection.then(function (conn) {
      return conn.createChannel().then(function (channel) {
        exName = 'amq.topic';
        return channel.assertExchange(exName, 'topic', {durable: true})
          .then(function () {
            return channel.assertQueue('', {exclusive: true});
          })
          .then(function (qok) {
            var queue = qok.queue;
            channel.bindQueue(queue, exName, routingKey);
            channel.consume(queue, function doWork (msg) {
              onListenCB(JSON.parse(msg.content.toString()), msg.fields.routingKey);
            });
          });
      });
    });
  },

  close: function () {
    pConnection.then(function (conn) {
      process.once('SIGINT', function () {
        conn.close();
      });
    });
  }

};
