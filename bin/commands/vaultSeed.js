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
  Vault = require('../../lib/api/core/vault'),
  ColorOutput = require('./colorOutput');

function commandVaultSeed (options) {
  const cout = new ColorOutput(options);

  console.log(cout.notice('[ℹ] Generating vault seed...\n'));

  const vaultSeed = Vault.generateSeed();

  console.log(cout.ok(`[✔] Your new vault seed is '${vaultSeed}'`));
  console.log(cout.ok('Put in in your .kuzzlerc file under the \'server.vaultKey\' entry.'));
}

module.exports = commandVaultSeed;
