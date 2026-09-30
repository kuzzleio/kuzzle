/**
 * The one decision L4 exists to make, written down once — and the surprise
 * underneath it.
 *
 * Every Mocha spec in this family opened with the same ten lines:
 *
 * ```js
 * beforeEach(() => {
 *   mockrequire("../../../lib/kuzzle", KuzzleMock);
 *   ({ Backend } = mockrequire.reRequire("../../../lib/core/backend/backend"));
 *   application = new Backend("black-mesa");
 * });
 * afterEach(() => { mockrequire.stopAll(); });
 * ```
 *
 * It reads as a mocking idiom, and half of it is: `mock-require` can only
 * affect a *later* `require`, so the subject had to be re-required after the
 * mock was registered. `vi.mock` is hoisted above the imports, so that half
 * disappears — the spec declares the substitution once at module level and
 * imports `Backend` normally.
 *
 * ⚠️ **The other half is not about mocking at all.** `backend.ts` holds
 * `global.app` in a module-level `_app`, behind a setter that throws
 * `"Cannot build an App instance: another one already exists"` on the second
 * write. One `new Backend()` per module evaluation is all the subject allows,
 * and `reRequire` was re-evaluating the module on every test — so the dance was
 * what made a per-test `new Backend()` legal, and nothing said so. Dropping it
 * for a plain import fails every test after the first in each file.
 *
 * So the re-evaluation stays, stated for what it is: {@link createBackend}
 * calls `vi.resetModules()` and imports the subject fresh. `vi.mock` survives a
 * reset — the registry is per test file, not per module graph — so the
 * substitution is still in place on every re-import.
 *
 * What cannot move into this file is the `vi.mock` call itself: it is hoisted
 * to the top of the module it is written in, so each spec carries its own four
 * lines.
 *
 * ```ts
 * vi.mock("../../../lib/kuzzle", async () => {
 *   const { FakeKuzzle } = await import("./fakeKuzzle");
 *
 *   return { Kuzzle: FakeKuzzle, default: FakeKuzzle };
 * });
 * ```
 *
 * Both names, because `lib/kuzzle` exports the class twice — `export { Kuzzle }`
 * and `export default` — and a factory answering only one leaves the other
 * resolving to `undefined` for whoever imports it that way. And `./fakeKuzzle`
 * rather than this file: see the warning there.
 */
import type { JSONObject } from "kuzzle-sdk";
import { vi } from "vitest";

import type { Backend } from "../../../lib/core/backend/backend";

export { FakeKuzzle } from "./fakeKuzzle";

/**
 * A fresh application, on a freshly evaluated module graph.
 *
 * `new Backend()` publishes itself on `global.app` (which is how
 * `BackendController` reads its own config) and that write may only happen once
 * per evaluation — hence the reset. Async for the same reason: the subject has
 * to be imported after it.
 */
export async function createBackend(name = "black-mesa"): Promise<Backend> {
  vi.resetModules();

  const { Backend } = await import("../../../lib/core/backend/backend");

  return new Backend(name);
}

/** Reaches a member the subject declares `private` or `_`-prefixed. */
export function internals(subject: object): JSONObject {
  return subject as unknown as JSONObject;
}
