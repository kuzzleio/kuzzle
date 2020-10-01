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

const
  debug = require('../../../util/debug')('kuzzle:bootstrap'),
  Bluebird = require('bluebird');

/**
 * Base class for index bootstraping.
 *
 * Allow to have a cluster safe bootstrap sequence played on only 1 node and
 * having other node to wait the end of the sequence.
 *
 * Bootstrap sequence have a configurable timeout.
 */
class SafeBootstrap {
  /**
   * @param {IndexStorage} indexStorage - Index storage engine
   * @param {Number} timeout - Bootstrap timeout
   */
  constructor (indexStorage, timeout) {
    this._indexStorage = indexStorage;
    this._attemptDelay = Math.round(timeout / 10);

    // IDs for config documents
    this._LOCK_ID = `${this._indexStorage.index}.lock`;
    this._BOOTSTRAP_DONE_ID = `${this._indexStorage.index}.done`;
  }

  /**
   * Sequence of actions to play for bootstrap
   * @abstract
   * @returns {Promise}
   */
  async _bootstrapSequence () {
    // can be overridden
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
   * If the bootstrap sequence has already been played, resolves the promise.
   *
   * Otherwise,
   *  if the lock is free, the bootstrap sequence will be played from this node
   *  otherwise, this node will wait until the bootstrap sequence is over.
   *
   * This method will reject if the bootstrap exceeds bootstrapLockTimeout value.
   *
   * @returns {Promise}
   */
  async startOrWait (attempt = 0) {
    let bootstrapDone = false;

    try {
      bootstrapDone = await this._indexStorage
        .exists('config', this._BOOTSTRAP_DONE_ID);
    }
    catch (e) {
      if (attempt === 3) {
        throw e;
      }

      await Bluebird.delay(1000);

      return this.startOrWait(attempt + 1);
    }

    if (bootstrapDone) {
      return null;
    }

    if (await this._isLocked()) {
      return this._waitTillUnlocked();
    }

    const bootstrapPromise = this._playBootstrap();

    // Reject the promise returned by startOrWait() if the call to
    // _playBootstrap takes too much time
    const waitPromise = this._waitTillUnlocked().then(() => bootstrapPromise);

    return Bluebird.race([
      waitPromise,
      bootstrapPromise
    ]);
  }

  /**
   * Play the bootstrap sequence, and then unlock the bootstrap lock.
   *
   * @returns {Promise}
   */
  async _playBootstrap () {
    await this._bootstrapSequence();

    // Ensure no node will replay bootstrap
    await this._indexStorage.create(
      'config',
      this._BOOTSTRAP_DONE_ID,
      { timestamp: Date.now() });

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
  async _waitTillUnlocked (attempts = 0) {
    const exists = await this._indexStorage.exists('config', this._LOCK_ID);

    if (! exists) {
      return null;
    }

    // Stop initialization sequence if bootstrapLockTimeout exceeded
    if (attempts > 10) {
      this._throwLockWaitTimeout();
    }

    return new Bluebird((resolve, reject) => {
      setTimeout(async () => {
        try {
          await this._waitTillUnlocked(attempts + 1);
          resolve();
        } catch (error) {
          reject(error);
        }
      }, this._attemptDelay);
    });
  }

  /**
   * Returns true if the bootstrap is already locked,
   * otherwise lock the bootstrap and return false
   * Lock older than 30 seconds are not considered valid and will be overwritten.
   *
   * @returns {Promise.<boolean>} - True if locked, false if we successfully locked
   */
  async _isLocked () {
    debug('Attempting to acquire lock %s', this._LOCK_ID);

    try {
      // attempt to acquire a lock
      await this._indexStorage.create(
        'config',
        this._LOCK_ID,
        { refresh: 'wait_for', timestamp: Date.now() });

      debug('Lock %s acquired.', this._LOCK_ID);

      return false;
    }
    catch (error) {
      // another lock exists, attempt to get it (it might have been deleted
      // since the last creation attempt so beware)
      debug('Lock %s already present. Getting lock information.', this._LOCK_ID);
    }

    let lock;

    try {
      lock = await this._indexStorage.get('config', this._LOCK_ID);
    }
    catch (error) {
      if (error.id !== 'services.storage.not_found') {
        throw error;
      }

      debug(
        'Couldn\'t get lock %s (already removed). Reattempting later.',
        this._LOCK_ID);

      // restart the locking attempt a bit later
      return true;
    }

    // If a node crashes during bootstrap, a lock may exist.
    // Check if this lock is old enough to be erased
    const thirtySecondsAgo = Date.now() - 30000;

    if (lock._source.timestamp < thirtySecondsAgo) {
      debug('Lock %s too old, overwriting it.', this._LOCK_ID);
      await this._indexStorage.createOrReplace(
        'config',
        this._LOCK_ID,
        { timestamp: Date.now() });

      return false;
    }

    debug('Lock %s already present. Waiting for release.', this._LOCK_ID);

    return true;
  }

  /**
   * Delete the bootstrap lock
   *
   * @returns {Promise}
   */
  _unlock () {
    debug('Removing lock %s', this._LOCK_ID);
    return this._indexStorage.delete('config', this._LOCK_ID);
  }
}

module.exports = SafeBootstrap;
