#!/usr/bin/env node

var
  captains = require('captains-log'),
  rc = require('rc'),
  params = rc('kuzzle'),
  Kuzzle = require('../lib/api');


module.exports = function () {

  var log = captains();
  log.info('Starting Kuzzle');

  var kuzzle = new Kuzzle();
  kuzzle.start(params);
};