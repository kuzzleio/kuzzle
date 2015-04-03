module.exports = {
	realtime: null,

	/**
	 * Initialize all workers
	 * Add here a new worker if needed
	 *
	 * @param kuzzle
	 * @param worker worker name that must be init
	 * @param onListenCB the callback called when a message has been received
	 * @param params additional parameter
	 */
	init: function (kuzzle, worker, onListenCB, params) {

		// Initialize a specific worker
		if(worker && onListenCB) {
			this[worker] = require('./'+worker);
			this[worker].init(kuzzle, params);
			this.realtime.listen().then(function (data) {
				onListenCB(data);
			});

			return this[worker];
		}

		// Initialize worker for realtime
		// This worker is the first worker to handle the request send by user
		this.realtime = require('./realtime');
		this.realtime.init(kuzzle);
		this.realtime.listen(function (data) {
			console.log(data);
		});

	}
};