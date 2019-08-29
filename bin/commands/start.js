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
  semver = require('semver'),
  loadJson = require('./loadJson'),
  ColorOutput = require('./colorOutput');

function commandStart (options = {}) {
  let kuzzle;

  if (semver.satisfies(process.version, '>= 8.0.0')) {
    kuzzle = new (require('../../lib/api/kuzzle'))();
  } else {
    // node6 compatible commands are one level deeper
    kuzzle = new (require('../../../lib/api/kuzzle'))();
  }

  const
    cout = new ColorOutput(options),
    kuzzleParams = {};

  cout.notice('[ℹ] Starting Kuzzle server');

  const promises = [];

  if (options.mappings) {
    promises.push(loadJson(options.mappings)
      .then(mappings => {
        kuzzleParams.mappings = mappings;
      }));
  }

  if (options.fixtures) {
    promises.push(loadJson(options.fixtures)
      .then(fixtures => {
        kuzzleParams.fixtures = fixtures;
      }));
  }

  if (options.securities) {
    promises.push(loadJson(options.securities)
      .then(securities => {
        kuzzleParams.securities = securities;
      }));
  }

  if (options.enablePlugins) {
    kuzzleParams.additionalPlugins = options.enablePlugins.split(',').map(x => x.trim());
  }

  return Promise.all(promises)
    .then(() => kuzzle.start(kuzzleParams))
    .then(() => {
      cout.ok('[✔] Kuzzle 2.x server ready');
      return kuzzle.adminExists()
        .then(res => {
          if (!res) {
            cout.warn('[!] [WARNING] There is no administrator user yet: everyone has administrator rights.');
            cout.notice('[ℹ] You can use the CLI or the admin console to create the first administrator user.');
            cout.notice('    For more information: https://docs.kuzzle.io/guide/1/essentials/security/');
          }
        });
    })
    .catch(err => {
      cout.error(`[x] [ERROR] ${err.stack}`);
      process.exit(1);
    });
}

module.exports = commandStart;
