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
  ColorOutput = require('../.utils/colorOutput'),
  loadJson = require('../.utils/loadJson'),
  getSdk = require('../.utils/getSdk');

function commandLoadSecurities (securitiesPath, options) {
  let
    sdk,
    opts = options;

  const cout = new ColorOutput(opts);

  return getSdk(options)
    .then(response => {
      sdk = response;

      return null;
    })
    .then(() => loadJson(securitiesPath))
    .then(securities => sdk.query({
      controller: 'admin',
      action: 'loadSecurities',
      refresh: 'wait_for',
      body: securities
    }, opts))
    .then(() => {
      cout.ok('[✔] Securities have been successfully loaded');
      process.exit(0);
    })
    .catch(err => {
      cout.error(err);
      process.exit(1);
    });
}

module.exports = commandLoadSecurities;
