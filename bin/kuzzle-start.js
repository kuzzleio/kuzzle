#!/usr/bin/env node
var
  captains = require('captains-log'),
  rc = require('rc'),
  Kuzzle = require('../lib');


module.exports = function () {
  var log = captains();
  log.info('Starting Kuzzle');

  Kuzzle.start(rc('kuzzle'));

  // is a fixture file has been specified to be inserted into database at Kuzzle start and we are launching a server ?
  if (process.env.FIXTURES != '' && process.argv.indexOf('--server') > -1) {

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
            kuzzle.log.info('Fixture import OK for', response);
          })
          .catch(function(error){
            kuzzle.log.error('Fixture import error for', error);
          })
        ;
      }
      kuzzle.log.info('All fixtures imports launched.');
    });
  }
};