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
    this.storage = this.kuzzle.internalEngine;
    this.config = this.kuzzle.internalEngine.config;
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
    if (await this.storage.exists('config', BOOTSTRAP_DONE_ID)) {
      return;
    }

    if (! await this.getLock()) {
      // Wait bootstrap to finish before returning
      await this.checkTimeout();

      const response = await this.storage.get('config', JWT_SECRET_ID);
      this.kuzzle.config.security.jwt.secret = response._source.seed;

      return;
    }

    return new Promise(async (resolve, reject) => {
      this.checkTimeout()
        .catch(error => reject(error));

      try {
        await this.bootstrap();
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
  async bootstrap () {
    const internalMappings = {
      [this.storage.index]: this.config.services.db.internalMappings
    };

    // Create internal index collections and mappings
    await this.kuzzle.janitor.loadMappings(internalMappings);

    // Create initials securities
    await this.kuzzle.janitor.loadSecurities(this.config.security.initial);

    // Create initials validations
    await this.kuzzle.janitor.loadFixtures(this._constructValidationFixtures());

    // Create datamodel version
    await this.storage.create('config', DATAMODEL_VERSION_ID, '2.0.0');

    // Generate JWT secret
    const secret = await this.generateJWTSecret();
    this.kuzzle.config.security.jwt.secret = secret;


    // Ensure no node will replay bootstrap
    await this.engine.create('config', BOOTSTRAP_DONE_ID, { timestamp: Date.now() });

    // Allow other nodes startup sequence to continue
    await this.unlock();
  }

  async generateJWTSecret () {
    if (await this.storage.exists('config', JWT_SECRET_ID)) {
      const response = await this.storage.get('config', JWT_SECRET_ID);

      return response._source.seed;
    }

    const seed = crypto.randomBytes(512).toString('hex');

    await this.storage.create('config', JWT_SECRET_ID, { seed });

    return seed;
  }

  /**
   * Wait until bootstrap is completed on this node or on another node.
   * A total of 10 attempts will be made before rejection.
   * Each attemps is delayed by bootstrapLockTimeout / 10 ms
   *
   * @returns {Promise}
   */
  async checkTimeout (attempts = 0) {
    const exists = await this.storage.exists('config', LOCK_ID);

    if (! exists) {
      return;
    }

    // Stop initialization sequence if bootstrapLockTimeout exceeded
    if (attemps > 10) {
      errorsManager.throw(
        'external',
        'internal_engine',
        'lock_wait_timeout');
    }

    const delay = this.config.bootstrapLockTimeout / 10;

    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          await this.checkTimeout(attempts + 1);
          resolve();
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  }

  /**
   * Delete the bootstrap lock
   *
   * @returns {Promise}
   */
  unlock () {
    return this.storage.delete('config', LOCK_ID);
  }

  /**
   * Try to get the bootstrap lock to initiate bootstrap sequence.
   * Lock older than 30 seconds are not considered valid and will be taken over.
   *
   * @returns {Promise<boolean>} - True if lock was acquired, false otherwise
   */
  async getLock () {
    let lock;

    try {
      lock = await this.storage.get('config', LOCK_ID);
    } catch (error) {
      // TODO check error code instead
      if (error.status !== 404) {
        throw error;
      }

      // Lock does not exists, create it
      await this.storage.create('config', LOCK_ID, { timestamp: Date.now() });

      return true;
    }

    // If a node crash during bootstrap, a lock may exists.
    // Check if this lock is old enough to be erased
    const thirtySecondsAgo = Date.now() - 30000;
    if (lock._source.timestamp < thirtySecondsAgo) {
      await this.storage.createOrReplace('config', LOCK_ID, { timestamp: Date.now() });

      return true;
    }

    return false;
  }

  _constructValidationFixtures () {
    const validations = {};

    for (const [index, collections] of Object.entries(this.config.validation)) {
      for (const [collection, validation] of Object.entries(collections)) {
        validations[`${index}#${collection}`] = {
          index,
          collection,
          validation
        };
      }
    }

    return validations;
  }
}

module.exports = InternalEngineBootstrap;
