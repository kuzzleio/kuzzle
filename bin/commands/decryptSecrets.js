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
  fs = require('fs'),
  path = require('path'),
  Vault = require('../../lib/api/core/vault'),
  readlineSync = require('readline-sync'),
  ColorOutput = require('./colorOutput');

function commandDecryptSecrets (file, options) {
  const
    vault = new Vault(),
    encryptedSecretsFile = file || process.env.KUZZLE_SECRETS_FILE || vault.defaultEncryptedSecretsFile,
    cout = new ColorOutput(options);

  if (!encryptedSecretsFile) {
    console.log(cout.error('[ℹ] You must provide the secrets file with encryptSecrets <file> or in KUZZLE_SECRETS_FILE environment variable'));
    process.exit(1);
  }

  if (!options.vaultKey && !process.env.KUZZLE_VAULT_KEY) {
    console.log(cout.error('[ℹ] You must provide the vault key with --vault-key <key> or in KUZZLE_VAULT_KEY environment variable'));
    process.exit(1);
  }

  let
    userIsSure,
    outputFile = options.outputFile;

  if (!options.outputFile) {
    outputFile = path.resolve(`${path.dirname(encryptedSecretsFile)}/${path.basename(encryptedSecretsFile, '.enc.json')}.json`);
  }

  if (fs.existsSync(outputFile) && !options.noint) {
    console.log(cout.warn(`[ℹ] You are going to overwrite the following file: ${outputFile}`));
    userIsSure = readlineSync.question('[❓] Are you sure? If so, please type "I am sure": ') === 'I am sure';
  } else {
    // non-interactive mode
    userIsSure = true;
  }

  if (!userIsSure) {
    console.log(cout.notice('[ℹ] Aborted'));
    process.exit(1);
  }

  console.log(cout.notice('[ℹ] Decrypting secrets...\n'));

  vault.prepareCrypto(options.vaultKey);

  try {
    const encryptedSecrets = JSON.parse(fs.readFileSync(encryptedSecretsFile, 'utf-8'));

    const secrets = vault.decryptObject(encryptedSecrets);

    fs.writeFileSync(outputFile, JSON.stringify(secrets, null, 2));

    console.log(cout.ok(`[✔] Secrets successfully decrypted: ${path.resolve(outputFile)}`));
  } catch (error) {
    console.error(cout.error(`[ℹ] Can not decrypt secret file: ${error.message}`));
    process.exit(1);
  }
}

module.exports = commandDecryptSecrets;
