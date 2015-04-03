/**
 * This hook factory for handle pubsub, will listen hook for:
 *
 * ****************
 * request:http -> emit when a request is received by server http (/lib/api/private/servers.js)
 *
 * ****************
 *
 */

module.exports = function pubsub (kuzzle) {

	kuzzle.on('request:http', function(object) {

		kuzzle.log.verbose('trigger event request:http in pubsub');
		kuzzle.workers.realtime.add('new-data', object);

	});

};