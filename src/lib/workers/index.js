var
	_ = require('lodash');

module.exports = {
	list: {},

	/**
	 * Initialize all workers
	 * Add here a new worker if needed
	 *
	 * @param kuzzle
	 * @param worker worker name that must be init
	 * @param params additional parameter
	 */
	init: function (kuzzle, worker, params) {

		// Initialize a specific worker
		if(worker && onListenCB) {
			this.list[worker] = require('./'+worker);
			this.list[worker].init(kuzzle, params);

			return this[worker];
		}

		// Initialize worker for realtime
		// This worker is the first worker to handle the request send by user
		this.list.realtime = require('./realtime');
		this.list.realtime.init(kuzzle);

	},

	shutdown: function() {
		_.forEach(this.list, function parseListWorkers (worker) {
			if(worker.shutdown === 'function') {
				worker.shutdown();
			}
		});
	}
};