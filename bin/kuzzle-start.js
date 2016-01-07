#!/usr/bin/env node
var
  rc = require('rc'),
  kuzzle = require('../lib');


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
██     KUZZLE ` + (kuzzle.isServer ? 'SERVER' : 'WORKER') + ` STARTED
████████████████████████████████████`);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
};