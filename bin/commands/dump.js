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
  ColorOutput = require('./colorOutput'),
  getSdk = require('./getSdk');

async function commandDump (options) {
  const
    cout = new ColorOutput(options);

  cout.notice('[ℹ] Creating dump file...');

  const
    sdk = await getSdk(options, 'http'),
    request = {
      controller: 'admin',
      action: 'dump',
      suffix: 'cli'
  };

  return sdk.query(request)
    .then(response => {
      cout.ok('[✔] Done!');
      cout.notice(`[ℹ] A dump report has been successfully generated in the "${response.result}" folder`);
      cout.notice('[ℹ] You can send the folder to the kuzzle core team at support@kuzzle.io');
      process.exit(0);
    })
    .catch(err => {
      cout.error(`[✖] ${err}`);
      process.exit(1);
    });
}

module.exports = commandDump;
