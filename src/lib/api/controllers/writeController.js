var
	// For create the unique id of the object that the use send
	uuid = require('node-uuid');

module.exports = function WriteController (kuzzle) {

	this.create = function (data) {
		// TODO: add validation logic -> object is valid ? + schema is valid ?
		data.msg._id = uuid.v4();

		// Emit the main event
		kuzzle.log.verbose('emit event request:http');
		kuzzle.emit('request:http', data);

		return {id: data.msg._id};
	};

};