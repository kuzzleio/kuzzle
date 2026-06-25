import { AsyncLocalStorage } from "node:async_hooks";
import { createLock, IoredisAdapter } from "redlock-universal";
import "../types/Global";

interface MutexContext {
  acquiredLocks: Set<string>;
}

const context = new AsyncLocalStorage<MutexContext>();

export interface MutexConfig {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  ttl?: number;
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

  const client = globalThis.cacheEngine.internal.client;
  const adapter = new IoredisAdapter(client);

  const lock = createLock({
    adapter,
    key,
    retryAttempts: config.retryAttempts ?? 10,
    retryDelay: config.retryDelay ?? 200,
    ttl: config.ttl ?? 30000,
  });

  return lock.using(async () => {
    const nextStore: MutexContext = {
      acquiredLocks: new Set(store?.acquiredLocks),
    };
    nextStore.acquiredLocks.add(key);

    return context.run(nextStore, callback);
  });
}
