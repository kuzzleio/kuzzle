/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

import { randomBytes } from "crypto";

import Bluebird from "bluebird";

import * as kerror from "../kerror";
import buildDebug from "./debug";
import "../types/Global";

const debug = buildDebug("kuzzle:mutex");
const fatal = kerror.wrap("core", "fatal");

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

// Every lock this process holds, so that it can give them back before it
// exits (see `Mutex.releaseAllBeforeExit`).
const held = new Set<Mutex>();
let exiting = false;

/**
 * Mutex class options
 */
export interface MutexOptions {
  /**
   * Delay between 2 lock attempts (default: 200)
   */
  attemptDelay?: number;

  /**
   * Mutex lock acquisition timeout, in milliseconds (default: -1)
   *   If `-1`, will try to acquire the lock indefinitely.
   *   If `0`, locking will fail immediately if it cannot lock with its 1st attempt
   */
  timeout?: number;

  /**
   * Lock TTL in milliseconds (default: 5000)
   */
  ttl?: number;
}

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
 *
 * @deprecated Use `withLock` from `./distributedLock` instead: it supports
 * real Redlock semantics and reentrancy. Do not mix `Mutex` and `withLock`
 * on the same resource key — they use incompatible acquisition/TTL formats
 * and will contend with (though never corrupt) each other's lock on that
 * key.
 */
export class Mutex {
  readonly resource: string;
  readonly mutexId: string;
  readonly attemptDelay: number;
  readonly timeout: number;
  readonly ttl: number;
  private _locked = false;

  /**
   * @param {string} resource - resource identifier to be locked (must be identical across all nodes)
   * @param {Object} [options] - mutex options
   *    - `attemptDelay`: delay between 2 lock attempts (default: 200)
   *    - `timeout`: mutex lock acquisition timeout, in milliseconds (default: -1)
   *                 If -1, will try to acquire the lock indefinitely.
   *                 If 0, locking will fail immediately if it cannot lock with
   *                 its 1st attempt.
   *    - `ttl`: lock TTL in milliseconds (default: 5000)
   */
  constructor(
    resource: string,
    { attemptDelay = 200, timeout = -1, ttl = 5000 }: MutexOptions = {},
  ) {
    this.resource = resource;
    this.mutexId = `${global.kuzzle.id}/${randomBytes(16).toString("hex")}`;
    this.attemptDelay = attemptDelay;
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
  async lock(): Promise<boolean> {
    if (this._locked) {
      throw fatal.get(
        "assertion_failed",
        `resource "${this.resource}" already locked by this mutex (id: ${this.mutexId})`,
      );
    }

    if (exiting) {
      return new Promise(() => {});
    }

    let duration = 0;

    do {
      this._locked = await global.kuzzle.ask(
        "core:cache:internal:store",
        this.resource,
        this.mutexId,
        { onlyIfNew: true, ttl: this.ttl },
      );

      duration += this.attemptDelay;

      if (!this._locked && (this.timeout === -1 || duration <= this.timeout)) {
        await Bluebird.delay(this.attemptDelay);
      }
    } while (
      !this._locked &&
      (this.timeout === -1 || duration <= this.timeout)
    );

    if (!this._locked) {
      debug("Failed to lock %s (mutex id: %s)", this.resource, this.mutexId);
      return false;
    }

    held.add(this);

    // Acquired while `releaseAllBeforeExit` was running: give it back at once.
    if (exiting) {
      await this.unlock();
      return new Promise(() => {});
    }

    debug("Resource %s locked (mutex id: %s)", this.resource, this.mutexId);

    return true;
  }

  /**
   * Unlock the mutex
   *
   * @return {Promise}
   */
  async unlock(): Promise<void> {
    if (!this._locked) {
      throw fatal.get(
        "assertion_failed",
        `tried to unlock the resource "${this.resource}", which is not locked (mutex id: ${this.mutexId})`,
      );
    }

    if (!delScriptRegistered) {
      await global.kuzzle.ask(
        "core:cache:internal:script:define",
        "delIfValueEqual",
        1,
        delIfValueEqualLua,
      );
      delScriptRegistered = true;
    }

    await global.kuzzle.ask(
      "core:cache:internal:script:execute",
      "delIfValueEqual",
      this.resource,
      this.mutexId,
    );

    this._locked = false;
    held.delete(this);

    debug("Resource %s freed (mutex id: %s)", this.resource, this.mutexId);
  }

  /**
   * Wait for the resource to be unlocked.
   * Return true if it waited until the unlocking
   * and false if it waited until the timeout
   *
   * @param {Object} [Options] - mutex options
   *    - `attemptDelay`: delay between 2 resource check (default: `this.attemptDelay`)
   *    - `timeout`: mutex wait acquisition timeout, in milliseconds (default: `this.timeout`)
   *                 If -1, will try to acquire the lock indefinitely.
   *                 If 0, locking will fail immediately if it cannot lock with
   *                 its 1st attempt.
   *
   * @return {Promise.<boolean>} True if the ressource has been unlocked before the `timeout`
   */
  async wait({
    attemptDelay = this.attemptDelay,
    timeout = this.timeout,
  }): Promise<boolean> {
    let duration = 0;

    let isLocked;

    do {
      isLocked = await global.kuzzle.ask(
        "core:cache:internal:get",
        this.resource,
      );

      duration += attemptDelay;

      if (isLocked && (timeout === -1 || duration <= timeout)) {
        await Bluebird.delay(attemptDelay);
      }
    } while (isLocked && (timeout === -1 || duration <= timeout));

    return !isLocked;
  }

  /**
   * Frees every lock this process holds, and stops it from taking new ones.
   * Only meant to be called right before `process.exit`.
   *
   * A process that exits holding a lock leaves it in Redis until its ttl
   * expires, and every node waiting on it waits that long. That is how a
   * node evicted while starting its plugins made another node time out
   * starting its own, and leave the cluster too (step 15, F-13).
   *
   * From then on, `lock()` never resolves: the process is about to exit, and
   * answering `false` would send its caller down a path meant for a lock
   * held by another node.
   */
  static async releaseAllBeforeExit(): Promise<void> {
    exiting = true;

    // Best effort: a lock that cannot be freed still expires with its ttl.
    await Promise.allSettled([...held].map((mutex) => mutex.unlock()));
  }

  get locked() {
    return this._locked;
  }
}
