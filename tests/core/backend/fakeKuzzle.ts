/**
 * What `Backend.start()` constructs in place of the real `Kuzzle`.
 *
 * `test/mocks/kuzzle.mock.js` served this role for the Mocha specs, and the
 * vitest tree refuses it (see `tests/mocks/kuzzle.ts`). What the backend
 * actually needs of it is four things: a constructor that publishes itself on
 * `global.kuzzle` — which is how `EmbeddedSDK` and `BackendStorage` reach it —
 * a `start()` to await, a `pipe()` to forward `trigger()` to, an event surface
 * for the `EmbeddedSDK` that `start()` builds, and the config it is handed,
 * which is where `BackendStorage` reads the storage engine's version and node.
 *
 * ⚠️ **This file must not import anything from `lib/`.** It is what the
 * `vi.mock("../../../lib/kuzzle")` factory loads, and the factory has to settle
 * before the mocked module can resolve: a module graph that reaches back into
 * `lib/kuzzle` from here deadlocks vitest at collection time, with no test, no
 * timeout and no error. The `Kuzzle` type is therefore not imported and the
 * cast lives at the call sites.
 */
import type { JSONObject } from "kuzzle-sdk";
import { vi } from "vitest";

export class FakeKuzzle {
  public config: JSONObject;
  public start = vi.fn(async () => undefined);
  public pipe = vi.fn(async () => undefined);
  /** `EmbeddedSDK`'s `FunnelProtocol` subscribes to the internal message bus. */
  public on = vi.fn();
  public once = vi.fn();
  public off = vi.fn();
  public emit = vi.fn();
  public ask = vi.fn(async () => undefined);
  public vault: JSONObject = { secrets: {} };
  public pluginsManager: JSONObject = {
    registerPipe: vi.fn(),
    unregisterPipe: vi.fn(),
  };

  constructor(config: JSONObject = {}) {
    // A copy, where production hands the real object. `loadConfig()` answers a
    // shared singleton and `BackendConfig` mutates it in place, so a spec that
    // pins `services.storageEngine.majorVersion` on `global.kuzzle.config`
    // would otherwise pin it for every spec that runs after it in the file.
    this.config = structuredClone(config);

    (global as { kuzzle: unknown }).kuzzle = this;
  }
}
