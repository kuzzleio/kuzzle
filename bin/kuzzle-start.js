#!/usr/bin/env node
var
  captains = require('captains-log'),
  rc = require('rc'),
  kuzzle = require('../lib');


module.exports = function () {
  var log = captains();
  log.info('Starting Kuzzle');

  kuzzle.start(rc('kuzzle'))
    .then(function () {
      return kuzzle.cleanDb();
    })
    .then(function () {
      return kuzzle.prepareDb();
    })
    .catch(function (error) {
      kuzzle.log.error(error);
    });
};