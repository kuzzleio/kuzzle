/**
 * The modules `lib/kuzzle/kuzzle.ts` pulls in, as stubs.
 *
 * They live in their own file importing nothing from `lib/`: a `vi.mock`
 * factory whose graph reaches back into the mocked module deadlocks at
 * collection time, with no test, no timeout and no output (step 13, L4b3).
 */
import { vi } from "vitest";

export const Koncorde = vi.fn();

export const vault = { load: vi.fn(() => ({})) };

/** One `init` per module, so a test can say which module was started. */
export const moduleInits = new Map<string, ReturnType<typeof vi.fn>>();

/**
 * A stand-in for one of the five modules `start()` builds and initialises:
 * `new CacheEngine().init()` and its four siblings.
 */
export function moduleStub(name: string) {
  const init = vi.fn(async () => undefined);

  moduleInits.set(name, init);

  return class {
    public init = init;
  };
}

/** Frees the locks taken through `withLock`; see `MutexStub` for the rest. */
export const releaseAllLocksBeforeExit = vi.fn(async () => undefined);

/**
 * The real `Mutex` talks to the cache. `Kuzzle` no longer takes one itself:
 * all it still does is free, on shutdown, those taken through the deprecated
 * API.
 */
export class MutexStub {
  static releaseAllBeforeExit = vi.fn(async () => undefined);
}

/** Puts every stub back between tests. */
export function reset(): void {
  Koncorde.mockClear();
  vault.load.mockClear();
  vault.load.mockReturnValue({});

  for (const init of moduleInits.values()) {
    init.mockClear();
  }

  MutexStub.releaseAllBeforeExit.mockClear();
  releaseAllLocksBeforeExit.mockClear();
}
