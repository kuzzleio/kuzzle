import { describe, expect, it } from "vitest";

import * as sdk from "kuzzle-sdk";

import * as kuzzle from "../index";

/**
 * `index.ts` re-exported the SDK with `export *` until ADR-0002 step 01, which
 * replaced it with an explicit list. That list must keep every runtime value
 * the SDK exports — the same object, not a copy — or a JavaScript consumer's
 * `require("kuzzle").WebSocket` breaks. (The type-level half is
 * tests/typings/consumer/sdkReexports.ts.)
 */
describe("index — the SDK re-export", () => {
  it.each(Object.keys(sdk))("re-exports the SDK's %s as is", (name) => {
    expect((kuzzle as Record<string, unknown>)[name]).toBe(
      (sdk as Record<string, unknown>)[name],
    );
  });
});
