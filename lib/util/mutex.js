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

const { randomBytes } = require('crypto');

const Bluebird = require('bluebird');

const kerror = require('../kerror');
const debug = require('./debug')('kuzzle:mutex');

const fatal = kerror.wrap('core', 'fatal');
const attemptDelay = 200;

// LUA script for Redis: we want our mutexes to only delete the lock they
// acquired. Prevents removing locks acquired by other processes if unlocking
// occurs after the lock expires
const delIfValueEqualLua = `
if redis.call("get",KEYS[1]) == ARGV[1]
then
    return redis.call("del",KEYS[1])
else
    return 0
end
`;

// Global: we need to register the LUA script only once. This variable is used
// to keep track of whether the script was already registered or not
let delScriptRegistered = false;

/**
 * Mutex meant to work across a kuzzle cluster.
 *
 * Allow to have a process played on only 1 node, with the other ones waiting
 * until the lock is freed.
 * Also works within a single node: in that case, it's better
 * if lock attempts from different parts of the code use different Mutex
 * instances: each mutex will lock using a unique ID, and the lock can only
 * be freed by that mutex instance, and it alone.
 *
 * /!\ Meant to be used only with 1 independant redis client (single node or
 * cluster). Which is what Kuzzle supports today.
 * If, in the future, Kuzzle is able to support multiple independant
 * Redis servers, then this class needs to implement redlock to properly handle
 * synchronization between servers (see https://redis.io/topics/distlock)
 */
class Mutex {
  /**
   * @param {Kuzzle} kuzzle
   * @param {string} id - lock unique id (must be identical across all nodes)
   * @param {Object} options - mutex options
   * @param {Number} options.timeout - mutex lock acquisition timeout in
   *                                 milliseconds
   *                                 if 0, locking will fail immediately if it
   *                                 cannot lock with its 1st attempt
   *                                 (default) if -1, will try to acquire the
   *                                 lock indefinitely
   * @param {Number} options.ttl - lock TTL in milliseconds (default: 5000)
   */
  constructor (kuzzle, id, { timeout = -1, ttl = 5000 } = {}) {
    this.kuzzle = kuzzle;
    this.lockId = id;
    this.mutexId = `${kuzzle.id}/${randomBytes(16).toString('hex')}`;
    this.locked = false;
    this.timeout = timeout;
    this.ttl = ttl;
  }

  /**
   * Locks the resource.
   * Resolves to a boolean telling whether the lock could be acquired before
   * the timeout or not.
   *
   * @return {Promise.<boolean>}
   */
  async lock () {
    if (this.locked) {
      throw fatal.get('assertion_failed', `resource "${this.lockId}" already locked by this mutex (id: ${this.mutexId})`);
    }

    let duration = 0;

    do {
      this.locked = await this.kuzzle.ask(
        'core:cache:internal:store',
        this.lockId,
        this.mutexId,
        { onlyIfNew: true, ttl: this.ttl });

      duration += attemptDelay;

      if (!this.locked && (this.timeout === -1 || duration <= this.timeout)) {
        await new Bluebird(resolve => setTimeout(resolve, attemptDelay));
      }
    }
    while (!this.locked && (this.timeout === -1 || duration <= this.timeout));

    if (!this.locked) {
      debug('Failed to lock %s (mutex id: %s)', this.lockId, this.mutexId);
      return false;
    }

    debug('Resource %s locked (mutex id: %s)', this.lockId, this.mutexId);

    return true;
  }

  /**
   * Unlock the mutex
   *
   * @return {Promise}
   */
  async unlock () {
    if (!this.locked) {
      throw fatal.get('assertion_failed', `tried to unlock the resource "${this.lockId}", which is not locked (mutex id: ${this.mutexId})`);
    }

    if (!delScriptRegistered) {
      await this.kuzzle.ask(
        'core:cache:internal:script:define',
        'delIfValueEqual',
        1,
        delIfValueEqualLua);
      delScriptRegistered = true;
    }

    await this.kuzzle.ask(
      'core:cache:internal:script:execute',
      'delIfValueEqual',
      this.lockId,
      this.mutexId);

    this.locked = false;

    debug('Resource %s freed (mutex id: %s)', this.lockId, this.mutexId);
  }
}

module.exports = Mutex;
