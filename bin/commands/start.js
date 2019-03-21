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

/* eslint-disable no-console */

const
  rc = require('rc'),
  loadJson = require('./loadJson'),
  ColorOutput = require('./colorOutput');

const
  params = rc('kuzzle');

function commandStart (options) {
  const
    kuzzle = new (require('../../lib/api/kuzzle'))(),
    cout = new ColorOutput(options);

  console.log(cout.kuz('[ℹ] Starting Kuzzle server'));

  kuzzle.start(params)
    .then(() => {
      console.log(cout.kuz('[✔] Kuzzle server ready'));
      return kuzzle.internalEngine.bootstrap.adminExists()
        .then(res => {
          if (res) {
            console.log(cout.warn('[!] [WARNING] There is no administrator user yet: everyone has administrator rights.'));
            console.log(cout.notice('[ℹ] You can use the CLI or the admin console to create the first administrator user.'));
            console.log(cout.notice('    For more information: https://docs.kuzzle.io/guide/essentials/security'));
          }
        });
    })
    .catch(err => {
      console.error(cout.error(`[x] [ERROR] ${err.stack}`));
      process.exit(1);
    });
}

module.exports = commandStart;
