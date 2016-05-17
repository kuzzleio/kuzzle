/* eslint-disable no-console */

var
  rc = require('rc'),
  params = rc('kuzzle'),
  Kuzzle = require('../../lib/api'),
  readlineSync = require('readline-sync'),
  fs = require('fs'),
  clc = require('cli-color'),
  error = clc.red,
  warn = clc.yellow,
  notice = clc.cyanBright;

module.exports = function () {
  var 
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
    kuzzle.remoteActions.do('cleanAndPrepare', params);
  } else {
    console.log(notice('[ℹ] Nothing have been done... you do not look that sure...'));
  }
};