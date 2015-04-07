var
	WriteController = require('./writeController');

module.exports = function FunnelController (kuzzle) {

	this.write = null;

	this.init = function () {
		this.write = new WriteController(kuzzle);
	};

	this.execute = function (object) {
		return this.write.create(object);
	};
};