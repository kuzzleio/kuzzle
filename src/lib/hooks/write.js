module.exports = {

	kuzzle: null,

	init: function (kuzzle) {
		this.kuzzle = kuzzle;
	},

	add: function (object) {
		this.kuzzle.log.verbose('trigger event request:http in pubsub');
		this.kuzzle.workers.list.write.add(object);
	}

};