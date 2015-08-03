/**
 * This PM2 file starts a Kuzzle instance
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

	kuzzle.start(rc('kuzzle'));
})();