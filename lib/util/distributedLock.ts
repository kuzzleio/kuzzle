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

import { AsyncLocalStorage } from "node:async_hooks";

import { Mutex as RedisMutex } from "redis-semaphore";
import type { LockOptions } from "redis-semaphore";

import buildDebug from "./debug";
import "../types/Global";

const debug = buildDebug("kuzzle:distributedLock");

/**
 * withLock() options
 */
export interface MutexConfig {
  /**
   * Number of acquisition retries after the first failed attempt, i.e. at
   * most `retryAttempts + 1` attempts are made (default: 10)
   */
  retryAttempts?: number;

  /**
   * Delay between 2 lock acquisition attempts, in milliseconds (default: 200)
   */
  retryDelay?: number;

  /**
   * Lock TTL in milliseconds (default: 30000)
   */
  ttl?: number;
}

/**
 * Thrown when a lock acquired by `withLock` is lost while its callback is
 * still running (e.g. TTL extension failed and another node may now hold
 * the lock).
 */
export class MutexLockLostError extends Error {
  constructor(key: string, cause?: Error) {
    super(`Lock lost for resource "${key}"`, cause ? { cause } : undefined);
    this.name = "MutexLockLostError";
  }
}

type RedisClient = ConstructorParameters<typeof RedisMutex>[0];

/**
 * redis-semaphore's mutex, adjusted to what `withLock` promises:
 *
 * - the lock lives under the resource key itself, as with the deprecated
 *   `Mutex` class (redis-semaphore would prefix it with "mutex:"), so both
 *   still contend on the same Redis key;
 * - a TTL extension that fails with a Redis error counts as a lost lock
 *   (redis-semaphore would let the error escape its refresh timer as an
 *   unhandled rejection, without knowing whether the lock is still held).
 *   The error is kept, to be reported as the loss's cause.
 */
class ResourceMutex extends RedisMutex {
  refreshError?: Error;

  constructor(client: RedisClient, key: string, options: LockOptions) {
    super(client, key, options);
    this._key = key;
  }

  protected async _refresh(): Promise<boolean> {
    try {
      return await super._refresh();
    } catch (error) {
      this.refreshError =
        error instanceof Error ? error : new Error(String(error));
      return false;
    }
  }
}

/**
 * Tracks, per async context, the set of lock keys already held by an
 * ancestor `withLock` call. Deliberately separate from the shared
 * `global.kuzzle.asyncStore`: that store always seeds a fresh Map on
 * `.run()` (it would silently discard whatever the parent context held) and
 * throws if no context is active yet (which would break locking used
 * outside a request scope, e.g. during boot or in background jobs).
 */
const lockContext = new AsyncLocalStorage<Set<string>>();

let clientPromise: Promise<RedisClient> | undefined;

/**
 * Lazily fetches and memoizes the internal cache's raw ioredis client.
 * Self-healing: if the very first call happens before the cache engine has
 * registered its ask handler (e.g. from an early plugin lifecycle hook), the
 * failure is not cached, so the next call retries instead of permanently
 * failing for the rest of the process.
 */
async function getClient(): Promise<RedisClient> {
  clientPromise ??= (async () =>
    global.kuzzle.ask("core:cache:internal:client:get"))().catch(
    (err: unknown) => {
      clientPromise = undefined;
      throw err;
    },
  );

  return clientPromise;
}

/**
 * Runs `callback` while holding a distributed, reentrant lock on `key`.
 *
 * Reentrant: if the current async context already holds `key` (i.e. this is
 * a nested call from inside another `withLock(key, ...)` call for the same
 * key), `callback` runs immediately with no new Redis round-trip, and
 * `config` is silently ignored (the ancestor's lock/TTL/retry settings
 * apply — this is correct reentrant-mutex semantics, not a bug).
 *
 * The lock's TTL is extended in the background while `callback` runs. If
 * the lock cannot be acquired within `retryAttempts + 1` attempts, the
 * returned promise rejects without running `callback`.
 *
 * If the lock is lost mid-callback (e.g. TTL extension failed and another
 * node may now hold it), the returned promise rejects with
 * `MutexLockLostError` as soon as that's detected. `callback` itself cannot
 * be cancelled and keeps running in the background; do not perform
 * authoritative side effects after observing this rejection.
 *
 * Do not use on the same resource key as the deprecated `Mutex` class
 * concurrently: both write to the same Redis key with incompatible
 * value/TTL formats and will contend with (but never corrupt) each other.
 *
 * @param key - resource identifier to be locked (must be identical across
 *              all nodes)
 * @param callback - executed while the lock is held
 * @param config - lock options (ignored if this call is reentrant)
 */
export async function withLock<T>(
  key: string,
  callback: () => Promise<T>,
  config: MutexConfig = {},
): Promise<T> {
  const held = lockContext.getStore();

  if (held?.has(key)) {
    return callback();
  }

  const { retryAttempts = 10, retryDelay = 200, ttl = 30000 } = config;
  const client = await getClient();

  const loss = new AbortController();
  const lockLost = new Promise<never>((_resolve, reject) => {
    loss.signal.addEventListener("abort", () => reject(loss.signal.reason), {
      once: true,
    });
  });
  // Only ever observed through the race below; never an unhandled rejection
  lockLost.catch(() => undefined);

  const mutex = new ResourceMutex(client, key, {
    acquireAttemptsLimit: retryAttempts + 1,
    acquireTimeout: Number.POSITIVE_INFINITY,
    lockTimeout: ttl,
    onLockLost: (error) => {
      loss.abort(new MutexLockLostError(key, mutex.refreshError ?? error));
    },
    retryInterval: retryDelay,
  });

  if (!(await mutex.tryAcquire())) {
    throw new Error(
      `Failed to acquire lock "${key}" after ${retryAttempts + 1} attempts`,
    );
  }

  try {
    const nextHeld = new Set(held);
    nextHeld.add(key);

    const callbackPromise = lockContext.run(nextHeld, () => callback());

    // Settles as soon as the lock is lost, without waiting for the callback
    return await Promise.race([callbackPromise, lockLost]);
  } finally {
    // A failed release only leaves the key to expire with its TTL: it must
    // not replace the callback's own outcome
    await mutex.release().catch((error: unknown) => {
      debug("Failed to release lock %s: %s", key, error);
    });
  }
}
