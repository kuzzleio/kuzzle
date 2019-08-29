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
  SafeBootstrap = require('./safeBootstrap'),
  crypto = require('crypto'),
  errorsManager = require('../../../config/error-codes/throw');

class InternalIndexBootstrap extends SafeBootstrap {
  constructor (kuzzle, storageEngine) {
    super(
      kuzzle,
      storageEngine,
      kuzzle.config.services.internalEngine.bootstrapLockTimeout);

    this.dataModelVersion = '2.0.0';

    // IDs for config documents
    this._DATAMODEL_VERSION_ID = 'internalIndex.dataModelVersion';
    this._JWT_SECRET_ID = 'security.jwt.secret';

    this.initialSecurities = {
      roles: {
        admin: {
          controllers: {
            '*': {
              actions: '*'
            }
          }
        },
        default: {
          controllers: {
            '*': {
              actions: '*'
            }
          }
        },
        anonymous: {
          controllers: {
            '*': {
              actions: '*'
            }
          }
        }
      },
      profiles: {
        admin: {
          policies: [ { roleId: 'admin' } ]
        },
        default: {
          policies: [ { roleId: 'default' } ]
        },
        anonymous: {
          policies: [ { roleId: 'anonymous' } ]
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
    await this.createInternalIndex();

    await super.startOrWait();

    this.kuzzle.config.security.jwt.secret = await this._getJWTSecret();
  }

  /**
   * @override
   */
  async _bootstrapSequence () {
    await this.createInitialSecurities();

    await this.createInitialValidations();

    await this._persistJWTSecret();

    // Create datamodel version
    await this.storage.create(
      'config',
      this._DATAMODEL_VERSION_ID,
      { version: this.dataModelVersion });
  }

  /**
   * @override
   */
  _throwLockWaitTimeout () {
    errorsManager.throw(
      'external',
      'internal_engine',
      'lock_wait_timeout');
  }


  createInternalIndex () {
    const
      internalCollections = this.kuzzle.config.services.db.internalIndex.collections,
      promises = [];

    for (const [collection, mappings] of Object.entries(internalCollections)) {
      promises.push(
        this.storage.createCollection(collection, mappings));
    }

    return Promise.all(promises);
  }

  createInitialSecurities () {
    const promises = [];

    for (const [roleId, content] of Object.entries(this.initialSecurities.roles)) {
      promises.push(
        this.storage.createOrReplace('roles', roleId, content));
    }

    for (const [profileId, content] of Object.entries(this.initialSecurities.profiles)) {
      promises.push(
        this.storage.createOrReplace('profiles', profileId, content));
    }

    return Promise.all(promises);
  }

  createInitialValidations () {
    const
      initialValidations = this.kuzzle.config.validation,
      promises = [];

    for (const [index, collection] of Object.entries(initialValidations)) {
      for (const [collectionName, validation] of Object.entries(collection)) {
        const validationId = `${index}#${collectionName}`;

        promises.push(
          this.storage.createOrReplace('validations', validationId, validation));
      }
    }

    return Promise.all(promises);
  }

  async _getJWTSecret () {
    if (this.kuzzle.config.security.jwt.secret) {
      return this.kuzzle.config.security.jwt.secret;
    }

    try {
      const response =
        await this.storage.get('config', this._JWT_SECRET_ID);

      return response._source.seed;
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }

      errorsManager.throw(
        'external',
        'internal_engine',
        'no_jwt_secret_available');
    }
  }

  async _persistJWTSecret () {
    let seed;

    if (this.kuzzle.config.security.jwt.secret) {
      seed = this.kuzzle.config.security.jwt.secret;
    } else {
      seed = crypto.randomBytes(512).toString('hex');
    }

    await this.storage.create('config', this._JWT_SECRET_ID, { seed });

    return seed;
  }
}

module.exports = InternalIndexBootstrap;
