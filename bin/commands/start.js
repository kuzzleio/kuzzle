/* eslint-disable no-console */

var
  fs = require('fs'),
  rc = require('rc'),
  params = rc('kuzzle'),
  kuzzle = require('../../lib'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  FirstAdmin = require('./createFirstAdmin'),
  q = require('q'),
  clc = require('cli-color'),
  coverage;

module.exports = function (options) {
  var
    error = string => options.parent.noColors ? string : clc.red(string),
    warn = string => options.parent.noColors ? string : clc.yellow(string),
    notice = string => options.parent.noColors ? string : clc.cyanBright(string),
    ok = string => options.parent.noColors ? string : clc.green.bold(string),
    kuz = string => options.parent.noColors ? string : clc.greenBright.bold(string),
    firstAdmin = new FirstAdmin(options, false);
  
  if (process.env.FEATURE_COVERAGE === '1' || process.env.FEATURE_COVERAGE === 1) {
    coverage = require('istanbul-middleware');
    console.log(warn('Hook loader for coverage - ensure this is not production!'));
    coverage.hookLoader(__dirname+'/../lib');
  }

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
      if (kuzzle.isServer) {
        return kuzzle.services.list.broker.waitForClients(kuzzle.config.queues.workerWriteTaskQueue);
      }
      return q();
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
      console.error(err.stack);
      process.exit(1);
    });
};
