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

const mutexes: MutexStub[] = [];

/**
 * The real `Mutex` talks to the cache; what a spec needs to see is that it was
 * taken, with what TTL, and when relative to the reads it guards.
 */
export class MutexStub {
  public lock = vi.fn(async () => true);
  public unlock = vi.fn(async () => undefined);
  public ttl: number;

  constructor(
    public id: string,
    options: { ttl?: number } = {},
  ) {
    this.ttl = options.ttl ?? 5000;
    mutexes.push(this);
  }
}

/** The mutex taken last — the one guarding the final import type. */
export const lastMutex = () => mutexes[mutexes.length - 1];

export const resetMutexes = () => {
  mutexes.length = 0;
};

/** Puts every stub back between tests. */
export function reset(): void {
  Koncorde.mockClear();
  vault.load.mockClear();
  vault.load.mockReturnValue({});

  for (const init of moduleInits.values()) {
    init.mockClear();
  }

  resetMutexes();
}
