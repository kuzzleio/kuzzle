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

const debug = require('../../../util/debug')('kuzzle:bootstrap:internalIndex');
const Bluebird = require('bluebird');
const SafeBootstrap = require('./safeBootstrap');
const ApiKey = require('../../../model/storage/apiKey');
const crypto = require('crypto');
const kerror = require('../../../kerror');

class InternalIndexBootstrap extends SafeBootstrap {
  constructor (kuzzle, indexStorage) {
    super(
      indexStorage,
      kuzzle.config.services.internalIndex.bootstrapLockTimeout);

    this._kuzzle = kuzzle;

    this.dataModelVersion = '2.0.0';

    // IDs for config documents
    this._DATAMODEL_VERSION_ID = 'internalIndex.dataModelVersion';
    this._JWT_SECRET_ID = 'security.jwt.secret';

    this.initialSecurities = {
      profiles: {
        admin: {
          policies: [ { roleId: 'admin' } ],
          rateLimit: 0
        },
        anonymous: {
          policies: [ { roleId: 'anonymous' } ]
        },
        default: {
          policies: [ { roleId: 'default' } ]
        }
      },
      roles: {
        admin: {
          controllers: {
            '*': {
              actions: {
                '*': true
              }
            }
          }
        },
        anonymous: {
          controllers: {
            '*': {
              actions: {
                '*': true
              }
            }
          }
        },
        default: {
          controllers: {
            '*': {
              actions: {
                '*': true
              }
            }
          }
        }
      }
    };
  }

  /**
   * @override
   *
   * @returns {Promise}
   */
  async startOrWait () {
    await this._indexStorage.createCollections(
      this._kuzzle.storageEngine.config.internalIndex.collections);

    await super.startOrWait();

    this._kuzzle.config.security.jwt.secret = await this._getJWTSecret();
  }

  /**
   * @override
   */
  async _bootstrapSequence () {
    debug('Bootstrapping security structure');
    await this.createInitialSecurities();

    debug('Bootstrapping document validation structure');
    await this.createInitialValidations();

    debug('Bootstrapping JWT secret');
    await this._persistJWTSecret();

    debug('Loading API keys into Redis');
    await this._loadApiKeys();

    // Create datamodel version
    try {
      await this._indexStorage.create(
        'config',
        this._DATAMODEL_VERSION_ID,
        { version: this.dataModelVersion });
    }
    catch (error) {
      if (error.id !== 'document_already_exists') {
        throw error;
      }
      // @cluster: avoid race condition when cluster start
    }
  }

  /**
   * @override
   */
  _throwLockWaitTimeout () {
    throw kerror.get('services', 'storage', 'bootstrap_timeout', 'internalIndex');
  }

  /**
   * Creates initial roles and profiles as specified in Kuzzle configuration
   *
   * @returns {Promise.<Object>} { roleIds, profileIds }
   */
  createInitialSecurities () {
    const
      options = { refresh: 'wait_for' },
      profileIds = [],
      roleIds = [],
      promises = [];

    for (const [roleId, content] of Object.entries(this.initialSecurities.roles)) {
      roleIds.push(roleId);
      promises.push(
        this._indexStorage.createOrReplace('roles', roleId, content, options));
    }

    for (const [profileId, content] of Object.entries(this.initialSecurities.profiles)) {
      profileIds.push(profileId);
      promises.push(
        this._indexStorage.createOrReplace('profiles', profileId, content, options));
    }

    return Bluebird.all(promises)
      .then(() => ({ profileIds, roleIds }));
  }

  createInitialValidations () {
    const
      initialValidations = this._kuzzle.config.validation,
      promises = [];

    for (const [index, collection] of Object.entries(initialValidations)) {
      for (const [collectionName, validation] of Object.entries(collection)) {
        const validationId = `${index}#${collectionName}`;

        promises.push(
          this._indexStorage.createOrReplace('validations', validationId, validation));
      }
    }

    return Bluebird.all(promises);
  }

  async _getJWTSecret () {
    if (this._kuzzle.config.security.jwt.secret) {
      return this._kuzzle.config.security.jwt.secret;
    }

    const response = await this._indexStorage.get('config', this._JWT_SECRET_ID);

    return response._source.seed;
  }

  async _persistJWTSecret () {
    let seed;

    if (this._kuzzle.config.security.jwt.secret) {
      seed = this._kuzzle.config.security.jwt.secret;
    }
    else {
      seed = crypto.randomBytes(512).toString('hex');
    }

    try {
      await this._indexStorage.create('config', this._JWT_SECRET_ID, { seed });
    }
    catch (e) {
      if (e.id !== 'services.storage.document_already_exists') {
        throw e;
      }

      // ignore: the secret already exists
    }
  }

  /**
   * Loads authentication token from API key into Redis
   *
   * @returns {Promise}
   */
  async _loadApiKeys () {
    const promises = [];
    const createToken = obj => this._kuzzle.ask(
      'core:security:token:assign',
      obj.token,
      obj.userId,
      obj.ttl);

    await ApiKey.batchExecute({ match_all: {} }, apiKeys => {
      for (const { _source } of apiKeys) {
        promises.push(createToken(_source));
      }
    });

    return Bluebird.all(promises);
  }
}

module.exports = InternalIndexBootstrap;
