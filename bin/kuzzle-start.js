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
 ██     KUZZLE ` + (kuzzle.isServer ? 'SERVER' : 'WORKER') + ` STARTED      ██`);

      if (kuzzle.isServer) {
        console.log(`
 ██   ...WAITING FOR WORKERS...    ██
 ████████████████████████████████████`);
      } else {
        console.log(' ████████████████████████████████████');
      }
    })
    .then(() => {
      /*
       Waits for at least one write worker to be connected to the server before trying to use them
       */
      return kuzzle.services.list.broker.waitForListeners(kuzzle.config.queues.workerWriteTaskQueue);
    })
    .then(() => {
      if (kuzzle.isServer) {
        console.log(`
 ████████████████████████████████████
 ██        WORKER CONNECTED        ██
 ██    ...PREPARING DATABASE...    ██
 ████████████████████████████████████`);
      }

      return kuzzle.cleanDb(kuzzle);
    })
    .then(() => {
      return kuzzle.prepareDb(kuzzle);
    })
    .then(() => {
      if (kuzzle.isServer) {
        console.log(`
 ████████████████████████████████████
 ██          KUZZLE READY          ██
 ████████████████████████████████████`);
      }
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
};