/* eslint-disable no-console */

var
  rc = require('rc'),
  params = rc('kuzzle'),
  Kuzzle = require('../../lib/api/kuzzle'),
  readlineSync = require('readline-sync'),
  fs = require('fs'),
  clc = require('cli-color');

function commandReset (options) {
  var
    error = string => options.parent.noColors ? string : clc.red(string),
    warn = string => options.parent.noColors ? string : clc.yellow(string),
    notice = string => options.parent.noColors ? string : clc.cyanBright(string),
    ok = string => options.parent.noColors ? string: clc.green.bold(string),
    userIsSure = false,
    kuzzle = new Kuzzle();

  // check, if files are provided, if they exists
  if (params.fixtures) {
    try {
      JSON.parse(fs.readFileSync(params.fixtures, 'utf8'));
    }
    catch (e) {
      console.log(error('[✖] The file ' + params.fixtures + ' cannot be opened... aborting.'));
      process.exit(1);
    }
  }

  if (params.mappings) {
    try {
      JSON.parse(fs.readFileSync(params.mappings, 'utf8'));
    }
    catch (e) {
      console.log(error('[✖] The file ' + params.mappings + ' cannot be opened... aborting.'));
      process.exit(1);
    }
  }

  console.log(warn('[ℹ] You are about to reset Kuzzle and make it like a virgin.'));
  console.log(warn('[ℹ] This operation cannot be undone.\n'));

  if (!params.noint) {
    userIsSure = readlineSync.question('[❓] Are you sure? If so, please type "I am sure" (if not just press [Enter]): ') === 'I am sure';
  } else {
    // not intteractive mode
    userIsSure = true;
  }

  if (userIsSure) {
    console.log(notice('[ℹ] Processing...\n'));
    return kuzzle.remoteActions.do('cleanDb', {}, {debug: options.parent.debug})
      .then(() => kuzzle.remoteActions.do('data', {
        fixtures: params.fixtures,
        mappings: params.mappings
      }, {debug: options.parent.debug}))
      .then(() => {
        console.log(ok('[✔] Kuzzle is now like a virgin, touched for the very first time!'));
        process.exit(0);
      })
      .catch(err => {
        console.error(err);
        process.exit(1);
      });
  }

  console.log(notice('[ℹ] Nothing have been done... you do not look that sure...'));
}

module.exports = commandReset;
