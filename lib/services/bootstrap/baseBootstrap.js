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

/**
 * Base class for index bootstraping.
 *
 * Allow to have a cluster safe bootstrap sequence played on only 1 node and
 * having other node to wait the end of the sequence.
 *
 * Bootstrap sequence have a configurable timeout.
 */
class BaseBootstrap {
  /**
   * @param {string} name
   * @param {Kuzzle} kuzzle
   * @param {InternalEngine} engine
   * @param {number} timeout
   */
  constructor (name, kuzzle, engine, timeout) {
    this.kuzzle = kuzzle;
    this.engine = engine;
    this.attemptDelay = Math.round(timeout / 10);

    // IDs for config documents
    this._LOCK_ID = `${name}.lock`;
    this._BOOTSTRAP_DONE_ID = `${name}.done`;
  }

  /**
   * Sequence of actions to play for bootstrap
   * @abstract
   * @param  {...any} args - Arguments given to startOrWait()
   * @returns {Promise}
   */
  _bootstrapSequence (...args) {
    throw new Error(`To be implemented. args: ${args.join()}`);
  }

  /**
   * Throw an error when the bootstrap timeout exceed
   * @abstract
   * @returns {Promise}
   */
  _throwLockWaitTimeout () {
    throw new Error('To be implemented.');
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
   * @param  {...any} args - Arguments passed to _bootstrapSequence() method
   *
   * @returns {Promise}
   */
  async startOrWait (...args) {
    if (await this.engine.exists('config', this._BOOTSTRAP_DONE_ID)) {
      return;
    }

    if (! await this._getLock()) {
      return this._checkTimeout();
    }

    return new Promise((resolve, reject) => {
      this._checkTimeout()
        .catch(error => reject(error));

      this._playBootstrap(...args)
        .then(() => resolve())
        .catch(error => reject(error));
    });
  }

  /**
   * Play the bootstrap sequence, and then unlock the bootstrap lock.
   *
   * @param  {...any} args - Arguments passed to _bootstrapSequence() method
   *
   * @returns {Promise}
   */
  async _playBootstrap (...args) {
    await this._bootstrapSequence(...args);

    // Ensure no node will replay bootstrap
    await this.engine.create('config', this._BOOTSTRAP_DONE_ID, { timestamp: Date.now() });

    // Allow other nodes startup sequence to continue
    await this._unlock();
  }

  /**
   * Wait until bootstrap is completed on this node or on another node.
   * A total of 10 attempts will be made before rejection.
   * Each attemps is delayed by bootstrapLockTimeout / 10 ms
   *
   * @returns {Promise}
   */
  async _checkTimeout (attempts = 0) {
    const exists = await this.engine.exists('config', this._LOCK_ID);

    if (! exists) {
      return;
    }

    // Stop initialization sequence if bootstrapLockTimeout exceeded
    if (attempts > 10) {
      this._throwLockWaitTimeout();
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
   * Try to get the bootstrap lock to initiate bootstrap sequence.
   * Lock older than 30 seconds are not considered valid and will be overwritter.
   *
   * @returns {Promise<boolean>} - True if lock was acquired, false otherwise
   */
  async _getLock () {
    let lock;

    try {
      lock = await this.engine.get('config', this._LOCK_ID);
    } catch (error) {
      if (! error.errorName.endsWith('document_not_found')) {
        throw error;
      }

      // Lock does not exists, create it
      await this.engine.create('config', this._LOCK_ID, { timestamp: Date.now() });

      return true;
    }

    // If a node crash during bootstrap, a lock may exists.
    // Check if this lock is old enough to be erased
    const thirtySecondsAgo = Date.now() - 30000;
    if (lock._source.timestamp < thirtySecondsAgo) {
      await this.engine.createOrReplace('config',this._LOCK_ID, { timestamp: Date.now() });

      return true;
    }

    return false;
  }

  /**
   * Delete the bootstrap lock
   *
   * @returns {Promise}
   */
  _unlock () {
    return this.engine.delete('config', this._LOCK_ID);
  }
}

module.exports = BaseBootstrap;