/* eslint-disable no-console */

var
  fs = require('fs'),
  rc = require('rc'),
  params = rc('kuzzle'),
  Kuzzle = require('../../lib/api/kuzzle'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  Promise = require('bluebird'),
  clc = require('cli-color'),
  coverage,
  kuzzleLogo = `
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
                  ▀▀`;

module.exports = function (options) {
  var
    kuzzle = new Kuzzle(),
    error = string => options.parent.noColors ? string : clc.red(string),
    warn = string => options.parent.noColors ? string : clc.yellow(string),
    notice = string => options.parent.noColors ? string : clc.cyanBright(string),
    ok = string => options.parent.noColors ? string : clc.green.bold(string),
    kuz = string => options.parent.noColors ? string : clc.greenBright.bold(string);

  if (process.env.FEATURE_COVERAGE === '1' || process.env.FEATURE_COVERAGE === 1) {
    coverage = require('istanbul-middleware');
    console.log(warn('Hook loader for coverage - ensure this is not production!'));
    coverage.hookLoader(__dirname+'/../lib');
  }
  console.log(kuz('Starting Kuzzle'));

  kuzzle.start(params)
    .then(() => {
      var request;

      if (params.likeAvirgin) {
        request = new RequestObject({controller: 'remoteActions', action: 'cleanDb', body: {}});
        return kuzzle.remoteActionsController.actions.cleanDb(kuzzle, request);
      }
      return Promise.resolve();
    })
    .then(() => {
      var
        request,
        data = {};

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
      return kuzzle.remoteActionsController.actions.prepareDb(request)
        .catch(() => Promise.resolve());
    })
    .then(() => {
      console.log(kuzzleLogo);
      console.log(`
 ████████████████████████████████████
 ██         KUZZLE IS READY        ██
 ████████████████████████████████████`);
      return kuzzle.remoteActionsController.actions.adminExists()
        .then((res) => {
          if (res.data.body.exists) {
            console.log(ok('[✔] It seems that you already have an admin account.'));
          }
          else {
            console.log(notice('[ℹ] There is no administrator user yet. You can use the CLI or the back-office to create one.'));
            console.log(notice('[ℹ] Entering no-administrator mode: everyone has administrator rights.'));
          }
        });
    })
    .catch(err => {
      console.error(err.stack);
      process.exit(1);
    });
};
