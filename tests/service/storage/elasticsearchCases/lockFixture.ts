/**
 * Stands in for `withLock` in the ES 7 and ES 8 specs: a free lock that runs
 * the callback at once, recording which lock was taken, with which options,
 * and whether it is still held. `failWith` makes the next locks fail as the
 * real one does when it cannot be taken or is lost, without running the
 * callback.
 *
 * Mocked in both `elasticsearch.test.ts` entry points, since a `vi.mock` only
 * applies to the file that declares it.
 */
import { vi } from "vitest";

import type { MutexConfig } from "../../../../lib/util/distributedLock";

export interface TakenLock {
  config: MutexConfig | undefined;
  held: boolean;
  key: string;
}

export const locks = {
  failWith: undefined as Error | undefined,
  taken: [] as TakenLock[],
};

export const withLock = vi.fn(
  async (
    key: string,
    callback: () => Promise<unknown>,
    config?: MutexConfig,
  ) => {
    const lock: TakenLock = { config, held: false, key };
    locks.taken.push(lock);

    if (locks.failWith) {
      throw locks.failWith;
    }

    lock.held = true;

    try {
      return await callback();
    } finally {
      lock.held = false;
    }
  },
);
