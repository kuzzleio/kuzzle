/* eslint-disable no-console */

var
  fs = require('fs'),
  rc = require('rc'),
  params = rc('kuzzle'),
  kuzzle = require('../../lib'),
  RequestObject = require('../../lib/api/core/models/requestObject'),
  firstAdmin = require('./createFirstAdmin'),
  q = require('q'),
  clc = require('cli-color'),
  error = clc.red,
  warn = clc.yellow,
  notice = clc.cyanBright,
  ok = clc.green.bold,
  kuz = clc.greenBright.bold,
  coverage;

if (process.env.FEATURE_COVERAGE === '1' || process.env.FEATURE_COVERAGE === 1) {
  coverage = require('istanbul-middleware');
  console.log(warn('Hook loader for coverage - ensure this is not production!'));
  coverage.hookLoader(__dirname+'/../lib');
}

module.exports = function () {
  console.log(kuz('Starting Kuzzle'), (kuzzle.isServer ? notice('Server') : warn('Worker')));

  kuzzle.start(params)
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
 ██     KUZZLE ` + (kuzzle.isServer ? 'SERVER' : 'WORKER') + ' STARTED      ██');

      if (kuzzle.isServer) {
        process.title = 'KuzzleServer';
        console.log(` ██   ...WAITING FOR WORKERS...    ██
 ████████████████████████████████████`);
      } else {
        process.title = 'KuzzleWorker';
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
      var request;
      if (kuzzle.isServer) {
        console.log(`
 ████████████████████████████████████
 ██        WORKER CONNECTED        ██
 ██    ...PREPARING DATABASE...    ██
 ████████████████████████████████████`);

        if (params.likeAvirgin) {
          request = new RequestObject({controller: 'remoteActions', action: 'cleanDb', body: {}});
          return kuzzle.remoteActionsController.actions.cleanDb(kuzzle, request);
        }
      }

      return q();
    })
    .then(() => {
      var 
        request,
        data = {};

      if (kuzzle.isServer) {
        if (params.fixtures) {
          try {
            JSON.parse(fs.readFileSync(params.fixtures, 'utf8'));
          }
          catch (e) {
            console.log(error('[✖] The file ' + params.fixtures + ' cannot be opened... aborting.'));
            process.exit(1);
          }
          data.fixtures = params.fixtures;
        }

        if (params.mappings) {
          try {
            JSON.parse(fs.readFileSync(params.mappings, 'utf8'));
          }
          catch (e) {
            console.log(error('[✖] The file ' + params.mappings + ' cannot be opened... aborting.'));
            process.exit(1);
          }
          data.mappings = params.mappings;
        }

        request = new RequestObject({controller: 'remoteActions', action: 'prepareDb', body: data});
        return kuzzle.remoteActionsController.actions.prepareDb(kuzzle, request);
      }

      return q();
    })
    .then(() => {
      if (kuzzle.isServer) {
        console.log(`
 ████████████████████████████████████
 ██          KUZZLE READY          ██
 ████████████████████████████████████`);
        firstAdmin.check()
          .then((res) => {
            if (res.result.total === 0) {
              console.log(notice('[ℹ] There is no administrator user yet. You can use the CLI or the back-office to create one.'));
            }
            console.log(notice('[ℹ] Entering no-administrator mode: everyone has administrator rights.'));
          })
          .catch(() => {
            console.log(ok('[✔] It seems that you already have an admin account.'));
          });
      }
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
};