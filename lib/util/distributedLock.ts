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

import { createLock, IoredisAdapter } from "redlock-universal";
import type { ExtendedAbortSignal, RedisAdapter } from "redlock-universal";

import "../types/Global";

/**
 * withLock() options
 */
export interface MutexConfig {
  /**
   * Maximum number of lock acquisition attempts (default: 10)
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

/**
 * Tracks, per async context, the set of lock keys already held by an
 * ancestor `withLock` call. Deliberately separate from the shared
 * `global.kuzzle.asyncStore`: that store always seeds a fresh Map on
 * `.run()` (it would silently discard whatever the parent context held) and
 * throws if no context is active yet (which would break locking used
 * outside a request scope, e.g. during boot or in background jobs).
 */
const lockContext = new AsyncLocalStorage<Set<string>>();

let adapterPromise: Promise<RedisAdapter> | undefined;

/**
 * Lazily builds and memoizes the redlock-universal adapter wrapping the
 * internal cache's raw ioredis client. Self-healing: if the very first call
 * happens before the cache engine has registered its ask handler (e.g. from
 * an early plugin lifecycle hook), the failure is not cached, so the next
 * call retries instead of permanently failing for the rest of the process.
 */
async function getAdapter(): Promise<RedisAdapter> {
  if (!adapterPromise) {
    adapterPromise = (async () => {
      const client = await global.kuzzle.ask("core:cache:internal:client:get");

      return new IoredisAdapter(client);
    })().catch((err) => {
      adapterPromise = undefined;
      throw err;
    });
  }

  return adapterPromise;
}

/**
 * Races `callbackPromise` against the lock's abort signal. Rejects with
 * `MutexLockLostError` as soon as the signal fires, without waiting for
 * `callbackPromise` to settle. `callbackPromise` itself cannot be cancelled
 * (no cooperative cancellation in JS) and keeps running in the background.
 */
async function raceAgainstLoss<T>(
  callbackPromise: Promise<T>,
  signal: ExtendedAbortSignal,
  key: string,
): Promise<T> {
  if (signal.aborted) {
    throw new MutexLockLostError(key, signal.error);
  }

  let onAbort: () => void;
  const abortPromise = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(new MutexLockLostError(key, signal.error));
    signal.addEventListener("abort", onAbort, { once: true });
  });

  try {
    return await Promise.race([callbackPromise, abortPromise]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
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
  const adapter = await getAdapter();
  const lock = createLock({ adapter, key, retryAttempts, retryDelay, ttl });

  return lock.using((signal) => {
    const nextHeld = new Set(held);
    nextHeld.add(key);

    const callbackPromise = lockContext.run(nextHeld, () => callback());

    return raceAgainstLoss(callbackPromise, signal, key);
  });
}
