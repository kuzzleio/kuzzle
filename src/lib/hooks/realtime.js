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

	/**
	 * The event request:http is triggered here, and a message is send to the queue
	 * in order to allow several workers to parse the same queue instead of have
	 * a single process on the same node that can handle the message
	 */
	kuzzle.on('request:http', function(object) {

		kuzzle.log.verbose('trigger event request:http in pubsub');
		kuzzle.workers.realtime.add(object);

	});

};