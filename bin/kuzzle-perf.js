#!/usr/bin/env node

var
  winston = require('winston'),
  rc = require('rc'),
  kuzzle = require('../lib');


module.exports = function () {
  var log = winston;
  log.info('Starting Kuzzle in PERFORMANCES TESTING mode');

  kuzzle.perf(rc('kuzzle'));
};