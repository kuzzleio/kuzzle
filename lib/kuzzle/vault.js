/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const { Vault } = require('kuzzle-vault');

function load (vaultKey, secretsFile) {
  // Using KaaF kuzzle is an npm package and is located under node_modules folder
  // We need to get back to root folder of the project to get the secret file
  const defaultEncryptedSecretsFile = __dirname.endsWith('/node_modules/kuzzle/lib/kuzzle') ?
    path.resolve(`${__dirname}/../../../../config/secrets.enc.json`) :
    path.resolve(`${__dirname}/../../config/secrets.enc.json`);

  const encryptedSecretsFile =
    secretsFile || process.env.KUZZLE_SECRETS_FILE || defaultEncryptedSecretsFile;

  let key = vaultKey;
  if (_.isEmpty(vaultKey) && ! _.isEmpty(process.env.KUZZLE_VAULT_KEY)) {
    key = process.env.KUZZLE_VAULT_KEY;
  }

  const fileExists = fs.existsSync(encryptedSecretsFile);
  // Abort if a custom secrets file has been provided but Kuzzle can't load it
  if (! _.isEmpty(process.env.KUZZLE_SECRETS_FILE) || ! _.isEmpty(secretsFile)) {
    assert(
      fileExists,
      `A secret file has been provided but Kuzzle cannot find it at "${encryptedSecretsFile}".`);
  }

  // Abort if a secret file is found (default or custom)
  // but no vault key has been provided
  assert(
    ! (fileExists && _.isEmpty(key)),
    'A secret file has been provided but Kuzzle cannot find the Vault key. Aborting.');

  // Abort if a vault key has been provided
  // but no secrets file can be loaded (default or custom)
  assert(
    ! (! _.isEmpty(key) && ! fileExists),
    `A Vault key is present but Kuzzle cannot find the secret file at "${encryptedSecretsFile}". Aborting.`);

  const vault = new Vault(key);

  if (key) {
    vault.decrypt(encryptedSecretsFile);
  }

  return vault;
}

module.exports = { load };
