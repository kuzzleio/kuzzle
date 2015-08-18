/**
 * This PM2 file starts a Kuzzle instance. Without any argument, a Kuzzle instance is launched, complete
 * with a server and a single set of workers.
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

if (process.env.NEW_RELIC_APP_NAME) {
  require('newrelic');
}

(function () {
  var
    kuzzle = require('./lib'),
    rc = require('rc');

  kuzzle.start(rc('kuzzle'));

  // is a reset has been asked and we are launching a server ?
  if (process.env.LIKE_A_VIRGIN == 1 && process.argv.indexOf('--server') > -1) {

    var result = kuzzle.services.list.readEngine.reset();
    if (result) {
      kuzzle.log.info('Reset done: Kuzzle is now like a virgin, touched for the very first time !');
    } else {
      kuzzle.log.error('Oops... something really bad happened during reset...');
    }
  }
})();