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

const assert = require('assert');

const Bluebird = require('bluebird');

const debug = require('./debug')('kuzzle:cluster:mutex');

// Unique set for all mutexes: only 1 mutex instance can ever be created
// for a given unique id. Prevents concurrent mutexes with the same id created
// by the same node
const mutexes = new Set();

/**
 * Mutex meant to work across a kuzzle cluster.
 *
 * Allow to have a process played on only 1 node, with the other ones waiting
 * until its freed.
 */
class ClusterMutex {
  /**
   * @param {Kuzzle} kuzzle
   * @param {string} id - mutex unique id (must be identical for all nodes)
   * @param {Number} timeout - mutex lock acquisition timeout and lock ttl
   */
  constructor (kuzzle, id, timeout) {
    assert(!mutexes.has(id), `Cannot create mutex ${id}: already used`);

    mutexes.add(id);

    this.kuzzle = kuzzle;
    this.id = id;
    this.locked = false;
    this._attemptDelay = Math.round(timeout / 10);
  }

  /**
   * Locks the resource. Will not resolve until the mutex can be locked.
   * Rejects if the resource cannot be locked before the attempt times out.
   *
   * @return {Promise}
   */
  async lock () {
    assert(!this.locked, 'Tried to acquire an already locked resource');

    let delay = 0;

    do {
      this.locked = await this.kuzzle.ask(
        'core:cache:internal:setnx',
        this.id,
        this.kuzzle.id);

      if (!this.locked) {
        await new Bluebird(resolve => setTimeout(resolve, this._attemptDelay));
        delay += this._attemptDelay;
      }
    }
    while (!this.locked && delay < this.timeout);

    if (!this.locked) {
      throw new Error(`Failed to acquire the lock ${this.id}`);
    }

    // Makes the lock automatically expire
    await this.kuzzle.ask('core:cache:internal:expire', this.id, this.timeout);

    debug('Lock %s acquired', this.id);
  }

  async unlock () {
    assert(this.locked, 'Tried to unlock a non-locked resource');

    await this.kuzzle.ask('core:cache:internal:del', this.id);
    this.locked = false;

    debug('Lock %s freed', this.id);
  }

  isLocked () {
    return this.locked;
  }
}

module.exports = ClusterMutex;
