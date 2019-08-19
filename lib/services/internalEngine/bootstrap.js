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
  errorsManager = require('../../config/error-codes/throw');


const
  LOCK_ID = 'internalEngine.bootstrap.lock',
  JWT_SECRET_ID = 'security.jwt.secret',
  DATAMODEL_VERSION_ID = 'internalEngine.dataModelVersion',
  BOOTSTRAP_DONE_ID = 'internalEngine.bootstrap.done';

class InternalEngineBootstrap {
  constructor (kuzzle) {
    this.kuzzle = kuzzle;
    this.engine = this.kuzzle.internalEngine;
    this.attemptDelay =
      Math.round(this.kuzzle.internalEngine.config.bootstrapLockTimeout / 10);
  }

  /**
   * Try to start the bootstrap sequence.
   * If the bootstrap sequence have already been played, resolve the promise.
   *
   * Otherwise,
   *  if the lock is free, the bootstrap sequence will be played from this node
   *  otherwise, this node will wait until the bootstrap sequence is over.
   *
   * This method will rejects if the bootstrap exceed bootstrapLockTimeout value.
   *
   * @returns {Promise}
   */
  async startOrWait () {
    await this._createInternalIndex();

    if (await this.engine.exists('config', BOOTSTRAP_DONE_ID)) {
      this.kuzzle.config.security.jwt.secret = await this._getJWTSecret();

      return;
    }

    if (! await this._getLock()) {
      // Wait bootstrap to finish before returning
      await this._checkTimeout();

      this.kuzzle.config.security.jwt.secret = await this._getJWTSecret();

      return;
    }

    await new Promise(async (resolve, reject) => {
      this._checkTimeout()
        .catch(error => reject(error));

      try {
        await this._bootstrap();

        this.kuzzle.config.security.jwt.secret = await this._getJWTSecret();

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Play the bootstrap sequence, and then unlock the bootstrap lock.
   *
   * @returns {Promise}
   */
  async _bootstrap () {
    await this.createInitialSecurities();

    await this._createInitialValidations();

    // Create datamodel version
    await this.engine.create('config', DATAMODEL_VERSION_ID, { version: '2.0.0' });

    // Persist JWT secret
    await this._persistJWTSecret();


    // Ensure no node will replay bootstrap
    await this.engine.create('config', BOOTSTRAP_DONE_ID, { timestamp: Date.now() });

    // Allow other nodes startup sequence to continue
    await this._unlock();
  }

  _createInternalIndex () {
    const
      internalMappings = this.kuzzle.config.services.db.internalMappings,
      promises = [];

    for (const [collection, mappings] of Object.entries(internalMappings)) {
      promises.push(this.engine.createCollection(collection, mappings));
    }

    return Promise.all(promises);
  }

  async createInitialSecurities () {
    const
      initialSecurities = this.kuzzle.config.security.initial,
      promises = [];

    for (const [roleId, content] of Object.entries(initialSecurities.roles)) {
      promises.push(this.engine.createOrReplace('roles', roleId, content));
    }

    for (const [profileId, content] of Object.entries(initialSecurities.profiles)) {
      promises.push(this.engine.createOrReplace('profiles', profileId, content));
    }

    return Promise.all(promises);
  }

  async _createInitialValidations () {
    const
      initialValidations = this.kuzzle.config.validation,
      promises = [];

    for (const [index, collection] of Object.entries(initialValidations)) {
      for (const [collectionName, validations] of Object.entries(collection)) {
        const
          validationId = `${index}#${collectionName}`,
          content = {
            index,
            collection: collectionName,
            validations
          };

        promises.push(
          this.engine.createOrReplace('validations', validationId, content));
      }
    }

    return Promise.all(promises);
  }

  async _getJWTSecret () {
    if (this.kuzzle.config.security.jwt.secret) {
      return this.kuzzle.config.security.jwt.secret;
    }

    try {
      const response = await this.engine.get('config', JWT_SECRET_ID);

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

    await this.engine.create('config', JWT_SECRET_ID, { seed });

    return seed;
  }

  /**
   * Wait until bootstrap is completed on this node or on another node.
   * A total of 10 attempts will be made before rejection.
   * Each attemps is delayed by bootstrapLockTimeout / 10 ms
   *
   * @returns {Promise}
   */
  async _checkTimeout (attempts = 0) {
    const exists = await this.engine.exists('config', LOCK_ID);

    if (! exists) {
      return;
    }

    // Stop initialization sequence if bootstrapLockTimeout exceeded
    if (attempts > 10) {
      errorsManager.throw(
        'external',
        'internal_engine',
        'lock_wait_timeout');
    }

    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          await this._checkTimeout(attempts + 1);
          resolve();
        } catch (error) {
          reject(error);
        }
      }, this.attemptDelay);
    });
  }

  /**
   * Delete the bootstrap lock
   *
   * @returns {Promise}
   */
  _unlock () {
    return this.engine.delete('config', LOCK_ID);
  }

  /**
   * Try to get the bootstrap lock to initiate bootstrap sequence.
   * Lock older than 30 seconds are not considered valid and will be taken over.
   *
   * @returns {Promise<boolean>} - True if lock was acquired, false otherwise
   */
  async _getLock () {
    let lock;

    try {
      lock = await this.engine.get('config', LOCK_ID);
    } catch (error) {
      //
      if (error.errorName.endsWith('index_or_collection_not_found')) {
        return false;
      }

      // Lock does not exists, create it
      await this.engine.create('config', LOCK_ID, { timestamp: Date.now() });

      return true;
    }

    // If a node crash during bootstrap, a lock may exists.
    // Check if this lock is old enough to be erased
    const thirtySecondsAgo = Date.now() - 30000;
    if (lock._source.timestamp < thirtySecondsAgo) {
      await this.engine.createOrReplace('config', LOCK_ID, { timestamp: Date.now() });

      return true;
    }

    return false;
  }
}

module.exports = InternalEngineBootstrap;
