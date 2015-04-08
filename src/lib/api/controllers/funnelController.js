var
	crypto = require('crypto'),
	WriteController = require('./writeController'),
	SubscribeController = require('./subscribeController');

module.exports = function FunnelController (kuzzle) {

	this.write = null;
	this.subscribe = null;

	this.init = function () {
		this.write = new WriteController(kuzzle);
		this.subscribe = new SubscribeController(kuzzle);
	};

	this.execute = function (object) {
		if (!object.controller) {
			kuzzle.log.error('No controller provided for object', object);
			return false;
		}
		if (!object.action) {
			kuzzle.log.error('No action provided for object', object);
			return false;
		}


		if (!this[object.controller][object.action] ||
			typeof this[object.controller][object.action] !== 'function') {

			kuzzle.log.error('No corresponding action', object.action, 'in controller', object.controller);
			return false;
		}

		if (!object.requestId) {
			var stringifyObject = JSON.stringify(object);
			object.requestId = crypto.createHash('md5').update(stringifyObject).digest('hex');
		}

		return this[object.controller][object.action](object);
	};
};