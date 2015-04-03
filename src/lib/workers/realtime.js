var broker = require('../services/broker');

module.exports = {

	init: function (kuzzle) {
		broker.init(kuzzle);
		this.listen();
	},

	add: function (data) {
		broker.add('task_queue', data);
	},

	listen: function () {
		broker.listen('task_queue', onListenRealtimeCB);
	}
};

function onListenRealtimeCB (data) {
	console.log(data);
}