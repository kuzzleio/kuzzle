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
    collection,
    
    reset = function(callback) {
    kuzzle.services.list.writeEngine.reset()
      .then(function(){
        kuzzle.log.info('Reset done: Kuzzle is now like a virgin, touched for the very first time !');
        if (callback) {
          callback();
        }
      })
      .catch(function(){
        kuzzle.log.error('Oops... something really bad happened during reset...');
        if (callback) {
          callback();
        }
      })
    ;
  };

  kuzzle.start(rc('kuzzle'));

  // is a reset has been asked and we are launching a server ?
  if (process.env.LIKE_A_VIRGIN == 1 && process.argv.indexOf('--server') > -1) {
    reset();
  }

  // is a fixture file has been specified to be inserted into database at Kuzzle start and we are launching a server ?
  if (process.env.FIXTURES != '' && process.env.FIXTURES !== undefined && process.argv.indexOf('--server') > -1) {

    // implies reset
    reset(function(){
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

        kuzzle.services.list.writeEngine.import(new RequestObject(fixture))
          .then(function(response){
            kuzzle.log.info('Fixture import OK', response);
          })
          .catch(function(error){
            kuzzle.log.error('Fixture import error', error);
          })
        ;
      }
      kuzzle.log.info('All fixtures imports launched.');
    });
  }
})();