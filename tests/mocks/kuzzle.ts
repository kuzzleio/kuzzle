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
import { JSONObject } from "kuzzle-sdk";

import { Kuzzle } from "../../lib/kuzzle";

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

/** Puts back whatever was on the global before the first {@link stubKuzzle}. */
export function restoreKuzzle(): void {
  if (previous === null) {
    return;
  }

  global.kuzzle = previous.kuzzle;
  global.nodeId = previous.nodeId;
  previous = null;
}
