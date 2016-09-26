/* eslint-disable no-console */

var
  rc = require('rc'),
  params = rc('kuzzle'),
  Kuzzle = require('../../lib/api/kuzzle'),
  readlineSync = require('readline-sync'),
  clc = require('cli-color');

module.exports = function (database, options) {
  var
    error,
    warn,
    notice,
    ok,
    question,
    userIsSure = false,
    data = {},
    kuzzle = new Kuzzle();

  if (options === undefined) {
    options = database;
    database = null;
  }

  data.database = database;

  error = string => options.parent.noColors ? string : clc.red(string);
  warn = string => options.parent.noColors ? string : clc.yellow(string);
  notice = string => options.parent.noColors ? string : clc.cyanBright(string);
  ok = string => options.parent.noColors ? string: clc.green.bold(string);
  question = string => options.parent.noColors ? string : clc.whiteBright(string);

  if (database === 'memoryStorage') {
    console.log(warn('[ℹ] You are about to clear Kuzzle memoryStorage database.'));
    console.log(warn('[ℹ] This operation cannot be undone.\n'));
    userIsSure = params.noint || readlineSync.question('[❓] Are you sure? If so, please type "I am sure" (if not just press [Enter]): ') === 'I am sure';
  } else if (database) {
    userIsSure = readlineSync.keyInYN(question('[❓] Do you want to clear Kuzzle internal cache for "'.concat(database, '".')));
  } else {
    userIsSure = readlineSync.keyInYN(question('[❓] Do you want to clear all Kuzzle internal cache'));
  }

  if (userIsSure) {
    console.log(notice('[ℹ] Processing...\n'));
    return kuzzle.remoteActions.do('clearCache', data)
      .then(() => {
        console.log(ok('[✔] Done!'));
        process.exit(0);
      })
      .catch(err => {
        console.log(error('[✖]', err));
        process.exit(1);
      });
  }

  console.log(notice('[ℹ] Nothing have been done... you do not look that sure...'));
};
