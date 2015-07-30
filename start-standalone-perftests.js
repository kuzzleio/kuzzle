/**
 * This file is compatible with pm2 and starts a Kuzzle main instance
 *
 * example for contribution purpose only:
 *   $ pm2 start app-start.js --watch -- --port 7512
 *   this command will start the Kuzzle service on port 7512
 *   and will re-launch every times a modification will is detected
 */

(function () {
	var
		kuzzle = require('./lib'),
		rc = require('rc');


	kuzzle.perf(rc('kuzzle'));

})();