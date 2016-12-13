/* eslint-disable no-console */

var
  fs = require('fs'),
  rc = require('rc'),
  params = rc('kuzzle'),
  Kuzzle = require('../../lib/api/kuzzle'),
  Request = require('kuzzle-common-objects').Request,
  Promise = require('bluebird'),
  clc = require('cli-color'),
  coverage;
  /*kuzzleLogo = `
                       ______     _____    
     _  ___   _ _____ |__  / |   | ____|   
    | |/ / | | |__  /   / /| |   |  _|     
    | ' /| | | | / /   / /_| |___| |_      
    | . \\| |_| |/ /_  /____|_____|_____| 
    |_|\\_\\\\___//____|    SERVER READY`;*/

function commandStart (options) {
  var
    kuzzle = new Kuzzle(),
    error = string => options.parent.noColors ? string : clc.red(string),
    warn = string => options.parent.noColors ? string : clc.yellow(string),
    notice = string => options.parent.noColors ? string : clc.cyanBright(string),
    kuz = string => options.parent.noColors ? string : clc.greenBright.bold(string);

  if (process.env.FEATURE_COVERAGE === '1' || process.env.FEATURE_COVERAGE === 1) {
    coverage = require('istanbul-middleware');
    console.log(warn('Hook loader for coverage - ensure this is not production!'));
    coverage.hookLoader(__dirname+'/../lib');
  }
  console.log(kuz('[ℹ] Starting Kuzzle server'));

  kuzzle.start(params)
    // fixtures && mapping
    .then(() => {
      var
        fixtures,
        promises = [];

      if (params.fixtures) {
        try {
          fixtures = JSON.parse(fs.readFileSync(params.fixtures, 'utf8'));
        }
        catch (e) {
          console.log(error('[✖] The file ' + params.fixtures + ' cannot be opened... aborting.'));
          process.exit(1);
        }

        Object.keys(fixtures).forEach(index => {
          Object.keys(fixtures[index]).forEach(collection => {
            promises.push(kuzzle.services.list.storageEngine.import(new Request({
              index,
              collection,
              body: {
                bulkData: fixtures[index][collection]
              }
            })));
          });
        });

        return Promise.all(promises);
      }
    })
    .then(() => {
      var
        mappings,
        promises = [];

      if (params.mappings) {
        try {
          mappings = JSON.parse(fs.readFileSync(params.mappings, 'utf8'));
        }
        catch (e) {
          console.log(error('[✖] The file ' + params.mappings + ' cannot be opened... aborting.'));
          process.exit(1);
        }

        Object.keys(mappings).forEach(index => {
          Object.keys(mappings[index]).forEach(collection => {
            promises.push(kuzzle.services.list.storageEngine.updateMapping(new Request({
              index,
              collection,
              body: mappings[index][collection]
            })));
          });
        });

        return Promise.all(promises);
      }
    })
    .then(() => {
      console.log(kuz('[✔] Kuzzle server ready'));
      return kuzzle.internalEngine.bootstrap.adminExists()
        .then((res) => {
          if (!res) {
            console.log(notice('[ℹ] There is no administrator user yet. You can use the CLI or the back-office to create one.'));
            console.log(notice('[ℹ] Entering no-administrator mode: everyone has administrator rights.'));
          }
        });
    })
    .catch(err => {
      console.error(err.stack);
      process.exit(1);
    });
}

module.exports = commandStart;
