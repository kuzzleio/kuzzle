#!/usr/bin/env node
var
  captains = require('captains-log'),
  rc = require('rc'),
  kuzzle = require('../lib');


module.exports = function () {
  var log = captains();
  log.info('Starting kuzzle');

  kuzzle.start(rc('kuzzle'));

  // is a fixture file has been specified to be inserted into database at Kuzzle start and we are launching a server ?
   if (process.env.FIXTURES != '' && process.env.FIXTURES !== undefined && process.argv.indexOf('--server') > -1) {

    // implies reset
    reset(function(){
      Kuzzle.log.info('Reading fixtures file',process.env.FIXTURES);

      try {
        fixtures = JSON.parse(fs.readFileSync(process.env.FIXTURES, 'utf8'));
      } catch(e) {
        Kuzzle.log.error('An error occured when reading the', process.env.FIXTURES,'file!');
        Kuzzle.log.error('Remember to put the file into the docker scope...');
        Kuzzle.log.error('Here is the original error:', e);

        return;
      }

      for (collection in fixtures) {

        Kuzzle.log.info('== Importing fixtures for collection', collection, '...');

        fixture = {
          action: 'import',
          persist: true,
          collection: collection,
          body: fixtures[collection]
        };

        Kuzzle.services.list.writeEngine.import(new RequestObject(fixture))
          .then(function(response){
            Kuzzle.log.info('Fixture import OK', response);
          })
          .catch(function(error){
            kKzzle.log.error('Fixture import error', error);
          })
        ;
      }
      Kuzzle.log.info('All fixtures imports launched.');
    });
  }
};