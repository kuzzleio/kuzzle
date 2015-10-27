#!/usr/bin/env node
var
  rc = require('rc'),
  winston = require('winston'),
  kuzzle = require('../lib');


module.exports = function () {
  var log = winston;
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