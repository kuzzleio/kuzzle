/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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
  const defaultEncryptedSecretsFile =
    path.resolve(`${__dirname}/../config/secrets.enc.json`);
  const encryptedSecretsFile =
    secretsFile || process.env.KUZZLE_SECRETS_FILE || defaultEncryptedSecretsFile;

  let key = vaultKey;
  if (_.isEmpty(vaultKey) && !_.isEmpty(process.env.KUZZLE_VAULT_KEY)) {
    key = process.env.KUZZLE_VAULT_KEY;
  }

  const fileExists = fs.existsSync(encryptedSecretsFile);
  const vault = new Vault(key);

  if (!_.isEmpty(secretsFile) || !_.isEmpty(process.env.KUZZLE_SECRETS_FILE)) {
    assert(
      fileExists,
      `A secret file has been provided but Kuzzle cannot find it at '${encryptedSecretsFile}'.`);

    assert(
      !_.isEmpty(key),
      'A secret file has been provided but Kuzzle cannot find the Vault key. Aborting.');
  }

  if (key) {
    assert(
      fs.existsSync(encryptedSecretsFile),
      `A Vault key is present but Kuzzle cannot find the secret file at '${encryptedSecretsFile}'. Aborting.`);

    vault.decrypt(encryptedSecretsFile);
  }

  return vault;
}

module.exports = { load };
