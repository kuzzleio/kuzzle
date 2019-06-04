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

'use strict';

const
  crypto = require('crypto'),
  _ = require('lodash'),
  fs = require('fs');

const defaultSecretsFile = '../../../config/secrets.enc.json';

class Vault {
  constructor (config) {
    this.config = config;
    this.secrets = {};
  }

  prepareCrypto (vaultKey = null) {
    if (typeof vaultKey === 'string' && vaultKey.length > 0) {
      this.vaultKey = vaultKey;
    }
    else if (typeof process.env.KUZZLE_VAULT_KEY === 'string'
      && process.env.KUZZLE_VAULT_KEY.length > 0
    ) {
      this.vaultKey = process.env.KUZZLE_VAULT_KEY;
    } else {
      return;
    }

    if (this.config.server.vaultSeed === '764c1afa2988981a') {
      // eslint-disable no-console
      console.warn(
        'You are using the default vault seed.\n',
        'It\' STRONGLY advised to change this value.\n',
        'Run bin/kuzzle vaultSeed to generate a new seed\n',
        'Then put it in your .kuzzlerc under the \'server.vaultSeed\' entry.\n');
    }

    this.vaultKeyHash = crypto.createHash('md5')
                              .update(this.vaultKey, 'utf-8')
                              .digest('hex')
                              .toUpperCase();

    this.cipherIV = this.config.server.vaultSeed.split('').splice(0, 16).join('');
  }

  init (secretsFile) {
    this.encryptedSecretsFile = secretsFile || defaultSecretsFile;

    const fileExists = fs.existsSync(this.encryptedSecretsFile);

    if (!this.vaultKey && !fileExists) {
      return Promise.resolve();
    }

    if (this.vaultKey && !fileExists) {
      return Promise.reject(
        'KUZZLE_VAULT_KEY is present and no secrets file can be found. Aborting.'
      );
    }

    if (!this.vaultKey && fileExists) {
      return Promise.reject(
        'A secrets file is present and no vault key can be found. Aborting.'
      );
    }

    return this._readJsonFile(this.encryptedSecretsFile)
      .then(encryptedSecrets => this.decryptObject(encryptedSecrets))
      .then(secrets => {
        this.secrets = secrets;

        return null;
      })
      .catch(error => {
        throw new Error(`Can not decrypt secrets: ${error.message}`);
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
      throw new Error('Can not find vault key. Aborting.');
    }

    const secrets = {};

    for (const key of Object.keys(encryptedSecrets)) {
      const value = encryptedSecrets[key];

      if (_.isPlainObject(value)) {
        secrets[key] = this.decryptObject(encryptedSecrets[key]);
      } else if (typeof value === 'string') {
        secrets[key] = this._decryptData(encryptedSecrets[key]);
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
      throw new Error('Can not find vault key. Aborting.');
    }

    const encryptedSecrets = {};

    for (const key of Object.keys(secrets)) {
      const value = secrets[key];

      if (_.isPlainObject(value)) {
        encryptedSecrets[key] = this.encryptObject(secrets[key]);
      } else if (typeof value === 'string') {
        encryptedSecrets[key] = this._encryptData(secrets[key]);
      }
    }

    return encryptedSecrets;
  }

  /**
   * Encrypt data with AES CBC using the secret key and the initialization vector
   */
  _encryptData (data) {
    const cipher = crypto.createCipheriv('aes-256-cbc', this.vaultKeyHash, this.cipherIV);

    cipher.update(data, 'utf8', 'hex');

    return cipher.final('hex');
  }

  /**
   * Decrypt data with AES CBC using the secret key and the initialization vector
   */
  _decryptData (data) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.vaultKeyHash, this.cipherIV);

    decipher.update(data, 'hex', 'utf8');

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