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

  kuzzle.remoteActions.do('swagger', params);
}