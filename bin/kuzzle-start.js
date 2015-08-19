#!/usr/bin/env node
var
  captains = require('captains-log'),
  rc = require('rc'),
  Kuzzle = require('../lib');


module.exports = function () {
  var log = captains();
  log.info('Starting Kuzzle');

  Kuzzle.start(rc('kuzzle'));
  // is a reset has been asked and we are launching a server ?
  if (process.env.LIKE_A_VIRGIN == 1 && process.argv.indexOf('--server') > -1) {

    kuzzle.services.list.writeEngine.reset()
      .then(function(){
        kuzzle.log.info('Reset done: Kuzzle is now like a virgin, touched for the very first time !');
      })
      .catch(function(){
        kuzzle.log.error('Oops... something really bad happened during reset...');
      })
    ;
  }
};