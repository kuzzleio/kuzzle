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

'use strict';

const
  assert = require('assert'),
  crypto = require('crypto'),
  _ = require('lodash'),
  fs = require('fs');

const defaultSecretsFile = '../../../config/secrets.enc.json';

class Vault {
  constructor () {
    this.secrets = {};
  }

  /**
   * Prepare crypto primitives.
   * Use the key passed in parameter or the KUZZLE_VAULT_KEY
   * environment variable.
   *
   * @param {string|null} vaultKey - key used to decrypt the secrets
   */
  prepareCrypto (vaultKey = null) {
    if (_.isString(vaultKey) && vaultKey.length > 0) {
      this.vaultKey = vaultKey;
    }
    else if (_.isString(process.env.KUZZLE_VAULT_KEY)
      && process.env.KUZZLE_VAULT_KEY.length > 0
    ) {
      this.vaultKey = process.env.KUZZLE_VAULT_KEY;
    }
    else {
      return;
    }

    this.vaultKeyHash = crypto.createHash('md5')
      .update(this.vaultKey, 'utf-8')
      .digest('hex')
      .toUpperCase();
  }

  /**
   * Init the vault with a decryption key and a file containing
   * the secrets, decrypt it and store decrypted secrets
   *
   * Rejects with an error if:
   *  - a key is found but no file
   *  - a file is found but no key
   *
   * @param {string|null} secretsFile - file containing the encrypted secrets
   * @returns {Promise}
   */
  init (secretsFile = null) {
    this.encryptedSecretsFile = secretsFile || process.env.KUZZLE_SECRETS_FILE || defaultSecretsFile;

    const fileExists = fs.existsSync(this.encryptedSecretsFile);

    if (!this.vaultKey && !fileExists) {
      return Promise.resolve();
    }

    assert(
      !(!this.vaultKey && fileExists),
      'A secrets file is present and no vault key can be found. Aborting.'
    );

    assert(
      !(this.vaultKey && !fileExists),
      'A vault key is present and no secrets file can be found. Aborting.'
    );

    return this._readJsonFile(this.encryptedSecretsFile)
      .then(encryptedSecrets => this.decryptObject(encryptedSecrets))
      .then(secrets => {
        this.secrets = secrets;

        return null;
      })
      .catch(error => {
        throw new Error(`Cannot decrypt secrets: ${error.message}`);
      });
  }

  /**
   * Iterate recursively through object values and try to
   * decrypt strings only.
   *
   * @param {object} encryptedSecrets - object containing the encrypted secrets
   */
  decryptObject (encryptedSecrets) {
    if (!this.vaultKey) {
      throw new Error('Cannot find vault key. Aborting.');
    }

    const secrets = {};

    for (const key of Object.keys(encryptedSecrets)) {
      const value = encryptedSecrets[key];

      if (_.isPlainObject(value)) {
        secrets[key] = this.decryptObject(value);
      } else if (_.isString(value)) {
        secrets[key] = this._decryptData(value);
      }
    }

    return secrets;
  }

  /**
   * Iterate recursively through object values and try to
   * encrypt strings only.
   *
   * @param {object} secrets - object containing the secrets
   */
  encryptObject (secrets) {
    if (!this.vaultKey) {
      throw new Error('Cannot find vault key. Aborting.');
    }

    const encryptedSecrets = {};

    for (const key of Object.keys(secrets)) {
      const value = secrets[key];

      if (_.isPlainObject(value)) {
        encryptedSecrets[key] = this.encryptObject(value);
      } else if (_.isString(value)) {
        encryptedSecrets[key] = this._encryptData(value);
      }
    }

    return encryptedSecrets;
  }

  /**
   * Encrypt data with AES CBC using the secret key and an initialization vector
   * It's not safe to re-use an IV , so we generate a new IV each time we encrypt
   * something and we store it next to the encrypted data.
   * See https://www.wikiwand.com/en/Block_cipher_mode_of_operation#/Initialization_vector_(IV)
   */
  _encryptData (data) {
    const
      iv = crypto.randomBytes(8).toString('hex'),
      cipher = crypto.createCipheriv('aes-256-cbc', this.vaultKeyHash, iv);

    cipher.update(data, 'utf8', 'hex');

    const encryptedData = cipher.final('hex');

    return `${encryptedData}.${iv}`;
  }

  /**
   * Decrypt data with AES CBC using the secret key and the initialization vector
   */
  _decryptData (data) {
    const
      [ encryptedData, iv ] = data.split('.'),
      decipher = crypto.createDecipheriv('aes-256-cbc', this.vaultKeyHash, iv);

    decipher.update(encryptedData, 'hex', 'utf8');

    return decipher.final('utf8');
  }

  _readJsonFile (file) {
    return new Promise((resolve, reject) => {
      fs.readFile(file, 'utf8', (error, rawData) => {
        if (error) {
          reject(error);
          return;
        }

        try {
          const data = JSON.parse(rawData);
          resolve(data);
        }
        catch (e) {
          reject(e);
        }
      });
    });
  }
}

module.exports = Vault;
