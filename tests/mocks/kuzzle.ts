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
    previous = { kuzzle: global.kuzzle, nodeId: global.nodeId };
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

  global.kuzzle = asKuzzle(kuzzle);
  global.nodeId = "knode-test";

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

  global.kuzzle = previous.kuzzle;
  global.nodeId = previous.nodeId;
  previous = null;
}
