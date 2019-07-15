/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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

const
  Bluebird = require('bluebird'),
  readlineSync = require('readline-sync'),
  ColorOutput = require('./colorOutput'),
  sendAction = require('./sendAction');

/** @type ColorOutput */
let cout;

function getUserName () {
  const username = readlineSync.question(cout.format.question('\n[❓] First administrator account name\n'));

  if (username.length === 0) {
    return getUserName();
  }

  return Bluebird.resolve(username);
}

function getPassword () {
  const password = readlineSync.question(cout.format.question('\n[❓] First administrator account password\n'),
    {hideEchoBack: true}
  );

  const confirmation = readlineSync.question(cout.format.question('Please confirm your password\n'),
    {hideEchoBack: true}
  );

  if (password !== confirmation) {
    cout.error('[✖] Passwords do not match.');
    return getPassword();
  }

  return Bluebird.resolve(password);
}

function shouldWeResetRoles () {
  return Bluebird.resolve(
    readlineSync.keyInYN(
      cout.format.question('[❓] Restrict rights of the default and anonymous roles?')));
}

function confirm (username, resetRoles) {
  let msg = `\n[❓] About to create the administrator account "${username}"`;

  if (resetRoles) {
    msg += ' and restrict rights of the default and anonymous roles';
  }

  msg += '.\nConfirm? ';
  return Bluebird.resolve(readlineSync.keyInYN(cout.format.question(msg)));
}

function commandCreateFirstAdmin (options) {
  let
    username,
    password,
    resetRoles;

  cout = new ColorOutput(options);

  process.stdin.setEncoding('utf8');
  const action = {
    controller: 'server',
    action: 'adminExists'
  };

  return sendAction(action, options)
    .then(adminExists => {
      if (adminExists.result.exists) {
        cout.error('An administrator account already exists.');
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
        cout.error('Abort.');
        process.exit(0);
      }

      const query = {
        controller: 'security',
        action: 'createFirstAdmin',
        _id: username,
        reset: resetRoles,
        body: {
          content: { },
          credentials: {
            local: {
              username,
              password
            }
          }
        }
      };

      return sendAction(query, options);
    })
    .then(() => {
      cout.ok(`[✔] "${username}" administrator account created`);

      if (resetRoles) {
        cout.ok('[✔] Rights restriction applied to the following roles: ');
        cout.ok('   - default');
        cout.ok('   - anonymous');
      }

      process.exit(0);
    })
    .catch(err => {
      cout.error(err.message);
      process.exit(1);
    });
}

module.exports = commandCreateFirstAdmin;
