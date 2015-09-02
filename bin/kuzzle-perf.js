#!/usr/bin/env node

var
  captains = require('captains-log'),
  rc = require('rc'),
  kuzzle = require('../lib');


module.exports = function () {
  var log = captains();
  log.info('Starting Kuzzle in PERFORMANCES TESTING mode');

  kuzzle.perf(rc('kuzzle'));
};