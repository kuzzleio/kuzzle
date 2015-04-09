var
	// Used for hash into md5 the data for generate a requestId
	crypto = require('crypto'),
	socket = require('socket.io'),
	async = require('async'),
	q = require('q'),
	WriteController = require('./writeController'),
	SubscribeController = require('./subscribeController');

module.exports = function FunnelController (kuzzle) {

	this.write = null;
	this.subscribe = null;

	this.init = function () {
		this.write = new WriteController(kuzzle);
		this.subscribe = new SubscribeController(kuzzle);
	};

	/**
	 * Execute in parallel all tests for check whether the object is well constructed
	 * Then generate a requestId if not provided and execute the right controller/action
	 * @param object
	 */
	this.execute = function (object) {
		var deferred = q.defer();

		async.parallel([
			// Test if the controller is well defined
			function (callback) {
				if (!object.controller) {
					kuzzle.log.error('No controller provided for object', object);
					callback('No controller provided for object');

					return false;
				}

				callback(false);
			}.bind(this),

			// Test if the action is well defined
			function (callback) {
				if (!object.action) {
					kuzzle.log.error('No action provided for object', object);
					callback('No action provided for object');

					return false;
				}

				callback(null);
			}.bind(this),

			// Test if a controller and an action exist for the object
			function (callback) {
				if (!this[object.controller] || !this[object.controller][object.action] ||
						typeof this[object.controller][object.action] !== 'function') {
					kuzzle.log.error('No corresponding action', object.action, 'in controller', object.controller);
					callback('No corresponding action and/or controller');

					return false;
				}

				callback(null);
			}.bind(this)
		],
		function onTestError (err) {
			if (err) {
				deferred.reject(err);
				return false;
			}

			// The request Id is optional, but we have to generate it if the user
			// not provide it. We need to return this id for let the user know
			// how to get real time information about his data
			if (!object.requestId) {
				var stringifyObject = JSON.stringify(object);
				object.requestId = crypto.createHash('md5').update(stringifyObject).digest('hex');
			}

			this.notify(object);
			deferred.resolve(this[object.controller][object.action](object));
		}.bind(this));

		return deferred.promise;
	};

	/**
	 * Notify on the request Id channel that we have a new object
	 * @param object
	 */
	this.notify = function (object) {
		kuzzle.io.emit(object.requestId, object);
	};
};