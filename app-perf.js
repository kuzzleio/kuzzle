/**
 * This PM2 file starts a Kuzzle instance in performance recording mode.
 * This should only be used for benchmarking purpose.
 *
 * Without any argument, a Kuzzle instance is launched, complete with a server and a single set of workers.
 *
 * This default configuration isn't optimal performance-wise. Instead, it's prefered to start a Kuzzle server, and
 * then spawns a couple of workers.
 *
 * To start a Kuzzle server:
 *    pm2 start -n 'server' app-start.js -- --server
 *
 * To start 3 sets of workers:
 *    pm2 start -n 'worker' -f -i 3 app-start.js -- --worker
 *
 * You can then scale up/down the number of workers:
 *   pm2 scale worker <new number of workers>
 *
 * Please check the default PM2 JSON configuration file provided in Kuzzle installation directories.
 *
 * To get a complete list of available options, launch 'bin/kuzzle.js start -h'
 */
(function () {
  var
		kuzzle = require('./lib'),
    rc = require('rc');

  kuzzle.perf(rc('kuzzle'));
})();