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
    rc = require('rc'),
    fs = require('fs'),
    RequestObject = require('./lib/api/core/models/requestObject'),
    result,
    fixtures = {},
    fixture,
    collection;

  kuzzle.start(rc('kuzzle'));

  var reset = function(callback) {
    result = kuzzle.services.list.readEngine.reset();
    if (result) {
      kuzzle.log.info('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
      kuzzle.log.info('Reset done: Kuzzle is now like a virgin, touched for the very first time !');
      kuzzle.log.info('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
    } else {
      kuzzle.log.error('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
      kuzzle.log.error('Oops... something really bad happened during reset...');
      kuzzle.log.error('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
    }
    if (callback) {
      callback();
    }
  }

  // is a reset has been asked and we are launching a server ?
  if (process.env.LIKE_A_VIRGIN == 1 && process.argv.indexOf('--server') > -1) {
    reset();
  }

  // is a fixture file has been specified to be inserted into database at Kuzzle start and we are launching a server ?
  if (process.env.FIXTURES != '' && process.argv.indexOf('--server') > -1) {

    // implies reset
    reset(function(){
      kuzzle.log.info('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
      kuzzle.log.info('Reading fixtures file',process.env.FIXTURES);

      try {
        fixtures = JSON.parse(fs.readFileSync(process.env.FIXTURES, 'utf8'));
      } catch(e) {
        kuzzle.log.error('An error occured when reading the', process.env.FIXTURES,'file!');
        kuzzle.log.error('Remember to put the file into the docker scope...');
        kuzzle.log.error('Here is the original error:', e);

        return;
      }

      for (collection in fixtures) {

        kuzzle.log.info('== Importing fixtures for collection', collection, '...');

        fixture = {
          action: 'import',
          persist: true,
          collection: collection,
          body: fixtures[collection]
        };

        kuzzle.services.list.readEngine.import(new RequestObject(fixture), function(error, response) {
          console.log('RESPONSE',error, response);
          if (error) {
            kuzzle.log.error('Fixture import error for', error);
          } else {
            kuzzle.log.log('Fixture import OK for', response);
          }
        });

      }
      kuzzle.log.info('All fixtures imports launched.');
      kuzzle.log.info('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
    });
  }
})();