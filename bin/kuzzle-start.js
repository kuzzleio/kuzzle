#!/usr/bin/env node
var
  rc = require('rc'),
  kuzzle = require('../lib');

if (process.env.NEW_RELIC_APP_NAME) {
  require('newrelic');
}

if (process.env.FEATURE_COVERAGE == 1) {
  var coverage = require('istanbul-middleware');
  console.log('Hook loader for coverage - ensure this is not production!');
  coverage.hookLoader(__dirname+'/lib');
}

module.exports = function () {
  console.log('Starting Kuzzle');

  kuzzle.start(rc('kuzzle'))
    .then(() => { return kuzzle.cleanDb(); })
    .then(() => { return kuzzle.prepareDb(); })
    .then(() => {
      console.log(
        `
      ▄▄▄▄▄      ▄███▄      ▄▄▄▄
   ▄█████████▄▄█████████▄▄████████▄
  ██████████████████████████████████
   ▀██████████████████████████████▀
    ▄███████████████████████████▄
  ▄███████████████████████████████▄
 ▀█████████████████████████████████▀
   ▀██▀        ▀██████▀       ▀██▀
          ██     ████    ██
                ▄████▄
                ▀████▀
                  ▀▀`
      );

      console.log(`
████████████████████████████████████
██     KUZZLE ` + (kuzzle.isServer ? 'SERVER' : 'WORKER') + ` STARTED      ██
████████████████████████████████████`);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
};