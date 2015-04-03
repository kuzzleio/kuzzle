module.exports = {
	realtime: null,

	init: function (kuzzle) {

		// Initialize worker for realtime
		// This worker is the first worker to handle the request send by user
		this.realtime = require('./realtime');
		this.realtime.init(kuzzle);
		this.realtime.listen().then(function (data) {
			console.log(data);
		});

	}
};