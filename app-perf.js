/**
 * This PM2 file starts a Kuzzle instance with the logger service activated.
 * It should only be used for benchmarking purpose.
 *
 * Example for contribution purpose only:
 *   $ pm2 start app-start.js --watch -- --port 7512
 *   this command will start a Kuzzle instance on port 7512
 *   and will relaunch it everytime a modification is detected in the source code
 */
(function () {
	var
		kuzzle = require('./lib'),
		rc = require('rc');

	kuzzle.perf(rc('kuzzle'));
})();