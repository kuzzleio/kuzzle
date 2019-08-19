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

const
  Bluebird = require('bluebird'),
  errorsManager = require('../../config/error-codes/throw');

/**
 *
 * @param {Kuzzle} kuzzle
 * @param {InternalEngine} engine
 * @constructor
 */
class PluginInternalEngineBootstrap {
  constructor(pluginName, kuzzle, engine) {
    this.kuzzle = kuzzle;
    this.engine = engine;
    this.pluginName = pluginName;
    this.attemptDelay = Math.round(
      this.kuzzle.config.plugins.common.bootstrapLockTimeout / 10);

    // We make 10 attempts to check if the db resource is still locked.
    // After that, we throw an error and abort Kuzzle's start sequence.
    // But if, for some reason, the lock is never deleted, we have to consider
    // it as outdated, and renew it.
    // This "outdated delay" should be long enough to still abort Kuzzle's
    // lock sequence, but short enough to not imped a production environment
    // for too long.
    this.outdatedDelay = 1.5 * this.kuzzle.config.plugins.common.bootstrapLockTimeout;
    this._lockId = `bootstrap-lock-${kuzzle.constructor.hash(this.pluginName)}`;
  }

  async startOrWait (collections) {
    if (! await this._getLock()) {
      return this._checkTimeout();
    }

    await this.createCollections(collections);

    await this.engine.refresh();

    for (const collection of Object.keys(collection)) {
      this.kuzzle.indexCache.add(this.engine.index, collection);
    }

    return this._unlock();
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
      lock = await this.engine.get('config', this._lockId);
    } catch (error) {
      // TODO check error code instead
      if (error.status !== 404) {
        throw error;
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

  createCollection (collection, mappings) {
    return this.engine.createCollection(collection, mappings)
      .then(response => {
        this.kuzzle.indexCache.add(this.engine.index, collection);

        return response;
      });
  }

  createCollections (collections) {
    const promises = [];

    for (const [collection, mappings] of Object.entries(collections)) {
      promises.push(this.createCollection(collection, mappings));
    }

    return Promise.all(promises);
  }

  _unlock () {
    return this.kuzzle.internalEngine.delete('config', this._lockId);
  }

  /**
   * Wait until bootstrap is completed on this node or on another node.
   * A total of 10 attempts will be made before rejection.
   * Each attemps is delayed by bootstrapLockTimeout / 10 ms
   *
   * @returns {Promise}
   */
  async _checkTimeout (attempts = 0) {
    const exists = await this.engine.exists('config', this._lockId);

    if (! exists) {
      return;
    }

    // Stop initialization sequence if bootstrapLockTimeout exceeded
    if (attemps > 10) {
      errorsManager.throw(
        'external',
        'internal_engine',
        'plugin_bootstrap_lock_wait_timeout',
        this.pluginName);
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

}

module.exports = PluginInternalEngineBootstrap;
