/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2017 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable no-console */

const
  clc = require('cli-color'),
  Bluebird = require('bluebird'),
  readlineSync = require('readline-sync'),
  rc = require('rc'),
  Kuzzle = require('../../lib/api/kuzzle'),
  kuzzle = new Kuzzle(),
  params = rc('kuzzle');

let
  clcQuestion = clc.whiteBright,
  clcOk = clc.green.bold,
  clcError = clc.red,
  clcWarn = clc.yellow;

function getUserName () {
  const username = readlineSync.question(clcQuestion('\n[❓] First administrator account name\n'));

  if (username.length === 0) {
    return getUserName();
  }

  return Bluebird.resolve(username);
}

function getPassword () {
  const password = readlineSync.question(clcQuestion('\n[❓] First administrator account password\n'),
    {hideEchoBack: true}
  );

  const confirmation = readlineSync.question(clcQuestion('Please confirm your password\n'),
    {hideEchoBack: true}
  );

  if (password !== confirmation) {
    console.log(clcError('[✖] Passwords do not match.'));
    return getPassword();
  }

  return Bluebird.resolve(password);
}

function shouldWeResetRoles () {
  return Bluebird.resolve(readlineSync.keyInYN(clcQuestion('[❓] Restrict rights of the default and anonymous roles?')));
}

function confirm (username, resetRoles) {
  let msg = `\n[❓] About to create the administrator account "${username}"`;

  if (resetRoles) {
    msg += ' and restrict rights of the default and anonymous roles';
  }

  msg += '.\nConfirm? ';
  return Bluebird.resolve(readlineSync.keyInYN(clcQuestion(msg)));
}

function commandCreateFirstAdmin (options) {
  let
    username,
    password,
    resetRoles;

  process.stdin.setEncoding('utf8');

  if (options.parent.noColors) {
    clcError = clcOk = clcQuestion = clcWarn = string => string;
  }

  return kuzzle.cli.doAction('adminExists', {})
    .then(adminExists => {
      if (adminExists.result.exists) {
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

      return kuzzle.cli.doAction('createFirstAdmin', {
        _id: username,
        reset: resetRoles,
        body: {
          username,
          password
        }
      }, {pid: params.pid, debug: options.parent.debug});
    })
    .then(() => {
      console.log(clcOk(`[✔] "${username}" administrator account created`));

      if (resetRoles) {
        console.log(clcOk('[✔] Rights restriction applied to the following roles: '));
        console.log(clcOk('   - default'));
        console.log(clcOk('   - anonymous'));
      }

      process.exit(0);
    })
    .catch(err => {
      console.error(clcError(err.message));
      process.exit(1);
    });
}

module.exports = commandCreateFirstAdmin;
