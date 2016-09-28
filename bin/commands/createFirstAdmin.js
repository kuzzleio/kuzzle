/* eslint-disable no-console */

var
  clc = require('cli-color'),
  Promise = require('bluebird'),
  readlineSync = require('readline-sync'),
  rc = require('rc'),
  Kuzzle = require('../../lib/api/kuzzle'),
  kuzzle = new Kuzzle(),
  params = rc('kuzzle'),
  clcQuestion = clc.whiteBright,
  clcOk = clc.green.bold,
  clcError = clc.red,
  clcWarn = clc.yellow;

function getUserName () {
  var username;

  username = readlineSync.question(clcQuestion('\n[❓] First administrator account name\n'));

  if (username.length === 0) {
    return getUserName();
  }

  return Promise.resolve(username);
}

function getPassword () {
  var
    password,
    confirmation;

  password = readlineSync.question(clcQuestion('\n[❓] First administrator account password\n'),
    {hideEchoBack: true}
  );
  confirmation = readlineSync.question(clcQuestion('Please confirm your password\n'),
    {hideEchoBack: true}
  );

  if (password !== confirmation) {
    console.log(clcError('[✖] Passwords do not match.'));
    return getPassword();
  }

  return Promise.resolve(password);
}

function shouldWeResetRoles () {
  return Promise.resolve(readlineSync.keyInYN(clcQuestion('[❓] Restrict rights of the default and anonymous roles?')));
}

function confirm (username, resetRoles) {
  var msg = `\n[❓] About to create the administrator account "${username}"`;

  if (resetRoles) {
    msg += ' and restrict rights of the default and anonymous roles';
  }

  msg += '.\nConfirm? ';
  return Promise.resolve(readlineSync.keyInYN(clcQuestion(msg)));
}

module.exports = function (options) {
  var
    username,
    password,
    resetRoles;

  process.stdin.setEncoding('utf8');

  if (options.parent.noColors) {
    clcError = clcOk = clcQuestion = string => string;
  }

  return kuzzle.remoteActions.do('adminExists', params)
    .then(adminExists => {
      if (adminExists.data.body.exists) {
        console.log('An administrator account already exists.');
        process.exit(0);
      }

      return getUserName();
    })
    .then(response => {
      username = response;
      return getPassword();
    })
    .then(pwd => {
      password = pwd;
      return shouldWeResetRoles();
    })
    .then(response => {
      resetRoles = response;

      return confirm(username, resetRoles);
    })
    .then(response => {
      if (!response) {
        console.log(clcWarn('Aborting'));
        process.exit(0);
      }

      return kuzzle.remoteActions.do('createFirstAdmin', {
        _id: username,
        password,
        reset: resetRoles
      }, {pid: params.pid, debug: options.parent.debug});
    })
    .then(() => {
      console.log(clcOk(`[✔] "${username}" administrator account created`));

      if (resetRoles) {
        console.log(clcOk('[✔] Rights restriction applied to the following roles: '));
        console.log(clcOk('   - default'));
        console.log(clcOk('   - anonymous'));
      }
    })
    .catch(err => {
      console.error(clcError(err));
      process.exit(1);
    });
};
