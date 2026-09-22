/**
 * The smallest `global.kuzzle` a unit under test can be constructed against.
 *
 * The vitest tree deliberately does not reach for `test/mocks/kuzzle.mock.js`:
 * that mock is a ~600-line stub of the whole application, and a spec that
 * depends on all of it cannot say which part of it the subject actually needs.
 * What a spec needs here is the opposite — a fixture small enough to read, so
 * that the next person can see exactly what the subject touches at
 * construction time.
 *
 * Whatever a caller passes is merged on top, so a spec can pin the one field
 * it is about without restating the rest.
 */
import type { JSONObject } from "kuzzle-sdk";
import { vi } from "vitest";

import type { Kuzzle } from "../../lib/kuzzle";

/**
 * `global.kuzzle` is declared as the real `Kuzzle`, and a fixture that
 * satisfied that type would be the ~600-line mock this file exists to avoid.
 * The cast is the honest form of what every unit spec in this repo does: hand
 * the subject the few fields it reads. It lives here, once, rather than at
 * each spec's assignment.
 */
const asKuzzle = (fixture: JSONObject) => fixture as unknown as Kuzzle;

let previous: { kuzzle: Kuzzle; nodeId: string | undefined } | null = null;

/**
 * ⚠️ `global.kuzzle` is not a plain property: `lib/kuzzle/kuzzle.ts` installs an
 * accessor over a module-level `_kuzzle`, whose **getter throws** while no
 * instance exists (`"Kuzzle instance not found"`) and whose **setter throws on
 * the second write** (`"Cannot build a Kuzzle instance: another one already
 * exists"`). `global.nodeId` is the same shape, installed by `backend.ts`.
 *
 * So both reading and assigning the global are unsafe, and *whether* they throw
 * depends on whether the spec's import graph happens to reach those modules —
 * which is not something a spec should have to know. This fixture therefore
 * neither reads nor assigns: it redefines the properties outright (both are
 * declared `configurable`), which is idempotent and independent of the guards.
 *
 * Same shape as the `global.app` singleton [step 13, L4a] found in
 * `backend.ts`; found here by the first spec whose graph reached
 * `lib/kuzzle/kuzzle.ts` before stubbing.
 */
function define(property: "kuzzle" | "nodeId", value: unknown): void {
  Reflect.defineProperty(global, property, {
    configurable: true,
    value,
    writable: true,
  });
}

/** What was on the global before, without tripping the getter's guard. */
function readGlobal(property: "kuzzle" | "nodeId"): unknown {
  try {
    return (global as unknown as Record<string, unknown>)[property];
  } catch {
    return undefined;
  }
}

/** A logger whose `child()` returns another one, as `kuzzle-logger` does. */
function stubLogger(): JSONObject {
  const logger: JSONObject = {
    debug: () => {},
    error: () => {},
    info: () => {},
    trace: () => {},
    warn: () => {},
  };

  logger.child = () => logger;

  return logger;
}

/**
 * Installs a `global.kuzzle` (and `global.nodeId`) for the duration of a spec,
 * remembering what was there. Pair it with {@link restoreKuzzle} in an
 * `afterEach`: vitest isolates per file by default, so leaving the global
 * behind is harmless only by virtue of a config setting the spec neither
 * states nor controls.
 */
export function stubKuzzle(overrides: JSONObject = {}): JSONObject {
  if (previous === null) {
    previous = {
      kuzzle: readGlobal("kuzzle") as Kuzzle,
      nodeId: readGlobal("nodeId") as string | undefined,
    };
  }

  const kuzzle: JSONObject = {
    ask: async () => undefined,
    config: {
      limits: {},
      plugins: {},
      services: { storageEngine: { client: {} } },
      version: "2.56.0",
    },
    emit: () => {},
    log: stubLogger(),
    on: () => {},
    once: () => {},
    vault: { secrets: {} },
    ...overrides,
  };

  define("kuzzle", asKuzzle(kuzzle));
  define("nodeId", "knode-test");

  return kuzzle;
}

/**
 * An `onAsk` / `ask` pair that behaves like the real bus: whatever a subject
 * registers under an event is what answering that event calls.
 *
 * A repository's `init()` is a list of `onAsk` registrations, and what its
 * spec has to state is that each event reaches the right method. The Mocha
 * specs did it by un-stubbing `kuzzle.ask` mid-test (`kuzzle.ask.restore()`),
 * which only works because the mock had stubbed a real emitter underneath.
 *
 * `fallback` answers the events nothing registered — the storage and cache
 * events a subject asks *for* rather than answers. Left out, an unregistered
 * event throws, so a spec that grows a dependency says so.
 */
export function stubAsk(
  fallback?: (event: string, ...args: unknown[]) => unknown,
) {
  const answerers = new Map<string, (...args: unknown[]) => unknown>();

  const onAsk = vi.fn((event: string, fn: (...args: unknown[]) => unknown) => {
    answerers.set(event, fn);
  });

  const ask = vi.fn(async (event: string, ...args: unknown[]) => {
    const answerer = answerers.get(event);

    if (answerer) {
      return answerer(...args);
    }

    if (fallback) {
      return fallback(event, ...args);
    }

    throw new Error(`unexpected ask("${event}")`);
  });

  return { answerers, ask, onAsk };
}

/** Puts back whatever was on the global before the first {@link stubKuzzle}. */
export function restoreKuzzle(): void {
  if (previous === null) {
    return;
  }

  define("kuzzle", previous.kuzzle);
  define("nodeId", previous.nodeId);
  previous = null;
}

/**
 * The whole event surface of `global.kuzzle`, backed by real registries.
 *
 * {@link stubAsk} answers the `onAsk`/`ask` pair; a subject that *registers*
 * listeners on several buses at once — `cluster/node` registers on four — needs
 * all of them to behave, because the only way to test a registration is to
 * fire it.
 *
 * `on`/`emit` allows several listeners per event, as an emitter does.
 * `onAsk`, `onCall` and `onPipe` are one answerer per event, as Kuzzle's are.
 * Firing an event nothing registered is a no-op for `emit` and a throw for the
 * three request/response buses, so a spec that grows a dependency says so.
 */
export function stubBus() {
  const listeners = new Map<string, ((...args: any[]) => unknown)[]>();
  const answerers = new Map<string, (...args: any[]) => unknown>();

  const answer =
    (kind: string) =>
    (event: string, ...args: unknown[]) => {
      const answerer = answerers.get(`${kind}:${event}`);

      if (!answerer) {
        throw new Error(`unexpected ${kind}("${event}")`);
      }

      return answerer(...args);
    };

  const register =
    (kind: string) => (event: string, fn: (...args: any[]) => unknown) => {
      answerers.set(`${kind}:${event}`, fn);
    };

  return {
    answerers,
    listeners,

    on: vi.fn((event: string, fn: (...args: any[]) => unknown) => {
      listeners.set(event, [...(listeners.get(event) ?? []), fn]);
    }),
    emit: vi.fn((event: string, ...args: unknown[]) => {
      for (const fn of listeners.get(event) ?? []) {
        fn(...args);
      }
    }),

    onAsk: vi.fn(register("ask")),
    ask: vi.fn(async (event: string, ...args: unknown[]) =>
      answer("ask")(event, ...args),
    ),

    onCall: vi.fn(register("call")),
    call: vi.fn((event: string, ...args: unknown[]) =>
      answer("call")(event, ...args),
    ),

    onPipe: vi.fn(register("pipe")),
    pipe: vi.fn(async (event: string, ...args: unknown[]) =>
      answer("pipe")(event, ...args),
    ),
  };
}
