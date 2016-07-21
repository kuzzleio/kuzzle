/* eslint-disable no-console */

var
  clc = require('cli-color'),
  Promise = require('bluebird'),
  readlineSync = require('readline-sync'),
  rc = require('rc'),
  Kuzzle = require('../../lib/api'),
  kuzzle = new Kuzzle(),
  params = rc('kuzzle'),
  clcQuestion = clc.whiteBright,
  clcOk = clc.green.bold,
  clcError = clc.red;

function getUserName () {
  var username;

  username = readlineSync.question(clcQuestion('\n[❓] Please enter a username for the first admin\n'));

  if (username.length === 0) {
    return getUserName();
  }

  return Promise.resolve(username);
}

function getPassword () {
  var
    password,
    confirmation;

  password = readlineSync.question(clcQuestion('\n[❓] Please enter a password for the account\n'),
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
  return Promise.resolve(readlineSync.keyInYN(clcQuestion('[❓] Reset roles?')));
}

function confirm (username, resetRoles) {
  var msg = `\n[❓] About to create admin user "${username}"`;

  if (resetRoles) {
    msg += ' and reset default roles';
  }
  msg += '.\nConfirm? ';
  return Promise.resolve(readlineSync.keyInYN(clcQuestion(msg)));
}

module.exports = function (options) {
  var
    username,
    password,
    resetRoles;

  if (options.parent.noColors) {
    clcError = clcOk = clcQuestion = string => string;
  }

  return kuzzle.remoteActions.do('adminExists', params)
    .then(adminExists => {
      if (adminExists.data.body) {
        console.log('admin user is already set');
        process.exit(0);
      }

      getUserName()
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
            process.exit(0);
          }

          return kuzzle.remoteActions.do('createFirstAdmin', {
            _id: username,
            password,
            reset: resetRoles
          },
          {pid: params.pid, debug: options.parent.debug});
        })
        .then(() => {
          console.log(clcOk(`[✔] "${username}" user created with admin rights`));

          if (resetRoles) {
            console.log(clcOk('[✔] "default" profile reset'));
            console.log(clcOk('[✔] "admin" profile reset'));
            console.log(clcOk('[✔] "anonymous" profile reset'));
            console.log(clcOk('[✔] "default" role reset'));
            console.log(clcOk('[✔] "admin" role reset'));
            console.log(clcOk('[✔] "anonymous" role reset'));
          }
          process.exit(0);
        })
        .catch(err => {
          console.error(err);
          process.exit(1);
        });
    })
    .then(() => {
            
    })
    .catch(err => console.log(err));
  
};
