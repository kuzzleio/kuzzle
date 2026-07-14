import { AsyncLocalStorage } from "node:async_hooks";
import {
  createLock,
  IoredisAdapter,
  type ExtendedAbortSignal,
} from "redlock-universal";

import "../types/Global";

interface MutexContext {
  acquiredLocks: Set<string>;
}

const context = new AsyncLocalStorage<MutexContext>();

export interface MutexConfig {
  retryAttempts?: number;
  retryDelay?: number;
  ttl?: number;
}

/**
 * Thrown when a lock is aborted (e.g. its TTL could not be extended in time)
 * while the protected callback was still running. The callback itself
 * cannot be forcibly interrupted, but the caller is notified that
 * exclusivity is no longer guaranteed instead of silently receiving a
 * result obtained under a lock that may have expired or been stolen.
 */
export class MutexLockLostError extends Error {
  public readonly cause?: Error;

  constructor(key: string, cause?: Error) {
    super(
      `Distributed lock for "${key}" was lost before the protected callback completed` +
        (cause ? `: ${cause.message}` : ""),
    );

    this.name = "MutexLockLostError";
    this.cause = cause;
  }
}

/**
 * Runs the callback while listening for the lock's abort signal, so that if
 * the lock could not be renewed (and might now be held by someone else),
 * the returned promise rejects instead of resolving as if the callback had
 * exclusive access the whole time.
 */
function runUnderLock<T>(
  key: string,
  callback: () => Promise<T>,
  signal: ExtendedAbortSignal,
): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new MutexLockLostError(key, signal.error));
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new MutexLockLostError(key, signal.error));

    signal.addEventListener("abort", onAbort, { once: true });

    callback().then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

export async function withLock<T>(
  key: string,
  callback: () => Promise<T>,
  config: MutexConfig = {},
): Promise<T> {
  const store = context.getStore();
  if (store?.acquiredLocks.has(key)) {
    return callback();
  }

  const client = await globalThis.kuzzle.ask("core:cache:internal:client:get");
  const adapter = new IoredisAdapter(client);

  const lock = createLock({
    adapter,
    key,
    retryAttempts: config.retryAttempts ?? 10,
    retryDelay: config.retryDelay ?? 200,
    ttl: config.ttl ?? 30000,
  });

  return lock.using((signal) => {
    const nextStore: MutexContext = {
      acquiredLocks: new Set(store?.acquiredLocks),
    };
    nextStore.acquiredLocks.add(key);

    return context.run(nextStore, () => runUnderLock(key, callback, signal));
  });
}
