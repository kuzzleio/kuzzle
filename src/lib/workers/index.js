module.exports = {
	realtime: null,

	run: function (kuzzle) {
		this.realtime = require('./realtime')(kuzzle);
	}
};