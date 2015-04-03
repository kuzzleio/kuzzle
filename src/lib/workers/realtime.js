var
	// Main library for manipulate amqp protocol like RabbitMQ
	amqp = require('amqplib'),
	// Library for manage promises
	q = require('q'),
	// Promise created by amqplib for handle amqp connection
	pConnection;

module.exports = {

	/**
	 * Initialize the connection with the amqp broker
	 * @param kuzzle
	 * @returns {boolean}
	 */
	init: function (kuzzle) {
		if(pConnection) {
			return false;
		}
		pConnection = amqp.connect('amqp://'+kuzzle.config.broker.host);
	},

	/**
	 * Allow to add an object in a specific room. If the room is not specified,
	 * we use the queue task_queue that allow to manage the Work Queues
	 * @param data object that must be insert in queue
	 * @param room
	 */
	add: function (data, room) {
		room = room || 'task_queue';

		pConnection.then(function (conn) {
			var pCreateChannel = conn.createChannel();
			return pCreateChannel.then(function (ch) {
				ch.assertQueue(room, {durable: true});
				ch.sendToQueue(room, new Buffer(JSON.stringify(data)), {deliveryMode: true});
			});
		});
	},

	/**
	 * Listen a specific room or the default room task_queue for handle Work Queues
 	 * @param room
	 * @returns promise
	 */
	listen: function (room) {
		var deferred = q.defer();

		room = room || 'task_queue';
		pConnection.then(function (conn) {
			// Close the connection if someone kill the server
			process.once('SIGINT', function () {
				conn.close();
			});

			return conn.createChannel().then(function (channel) {
				return channel.assertQueue(room, {durable: true})
					.then(function () {
						channel.prefetch(1);
					})
					.then(function () {
						channel.consume(room, doWork);
					});

				function doWork (msg) {
					channel.ack(msg);
					deferred.resolve(JSON.parse(msg.content.toString()));
				}
			});
		});

		return deferred.promise;
	}
};