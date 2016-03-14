var
  rc = require('rc'),
  params = rc('kuzzle'),
  Kuzzle = require('../../lib/api'),
  readlineSync = require('readline-sync'),
  clc = require('cli-color'),
  error = clc.red,
  warn = clc.yellow,
  question = clc.whiteBright,
  notice = clc.cyanBright,
  ok = clc.green.bold,
  kuz = clc.greenBright.bold;

module.exports = function () {
  
  console.log(warn('[ℹ] You are about to reset Kuzzle and make it like a virgin.'));
  console.log(warn('[ℹ] This operation cannot be undone.\n'));

  if (readlineSync.question('[❓] Are you sure ? If so, please type "I am sure": ') === 'I am sure') {

    var kuzzle = new Kuzzle(false);
    kuzzle.cleanAndPrepare(params, true);

  } else {

    console.log(notice('[ℹ] Nothing have been done... you do not look that sure...'));

  }

};