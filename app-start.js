/**
 * This file is compatible with pm2 for start a Kuzzle service
 *
 * example for contribution purpose only:
 *   $ pm2 start app-start.js --watch -- --port 8080
 *   this command will start the Kuzzle service on port 8080
 *   and will re-launch every times a modification will be done
 */

if (process.env.NEW_RELIC_APP_NAME) {
  require('newrelic');
}

(function () {

	var
		kuzzle = require('./lib'),
		rc = require('rc');


	kuzzle.start(rc('kuzzle'));

})();