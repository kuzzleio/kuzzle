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
  rc = require('rc'),
  params = rc('kuzzle'),
  readlineSync = require('readline-sync'),
  ColorOutput = require('./colorOutput'),
  getSdk = require('./getSdk');

function commandResetSecurity (options) {
  const
    cout = new ColorOutput(options);

  let userIsSure = false;

  cout.warn('[ℹ] You are about to clear all created users, profiles and roles.');
  cout.warn('[ℹ] This operation cannot be undone.\n');

  if (!params.noint) {
    userIsSure = readlineSync.question('[❓] Are you sure? If so, please type "I am sure": ') === 'I am sure';
  }
  else {
    // non-interactive mode
    userIsSure = true;
  }

  if (userIsSure) {
    cout.notice('[ℹ] Processing...\n');
    const request = {
      controller: 'admin',
      action: 'resetSecurity'
    };

    return getSdk(options)
      .then(sdk => sdk.query(request))
      .then(() => {
        cout.ok('[✔] Kuzzle users, profiles and roles have been successfully reset');
        process.exit(0);
      })
      .catch(err => {
        cout.error(err);
        process.exit(1);
      });
  }

  cout.notice('[ℹ] Aborted');
}

module.exports = commandResetSecurity;
