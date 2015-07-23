#!/usr/bin/env node

var
  captains = require('captains-log'),
  rc = require('rc'),
  params = rc('kuzzle'),
  Kuzzle = require('../lib/api');


module.exports = function () {


  var log = captains();
  log.info('Starting Kuzzle in PERF MODE ');

  var kuzzle = new Kuzzle();

  kuzzle.perf(params);
};