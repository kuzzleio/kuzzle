import { afterEach, describe, expect, it } from "vitest";

import { hilightUserCode, removeStacktrace } from "../../lib/util/stackTrace";

const NODE_ENV = global.NODE_ENV;

afterEach(() => {
  global.NODE_ENV = NODE_ENV;
});

// Ported from `test/util/stacktrace.test.js`, which was the only spec on this
// function: `removeStacktrace`'s own cases below reach it, so it read as 100%
// covered while none of its three classification branches was ever asserted.
describe("#hilightUserCode", () => {
  it("ignores the error message, which has no frame in it", () => {
    const line = "Something is wrong with people";

    expect(hilightUserCode(line)).toBe(line);
  });

  it("ignores an already enhanced line", () => {
    const line =
      "> at BackendController._add (/home/kuzzle/lib/core/application/backend.ts:261:28)";

    expect(hilightUserCode(line)).toBe(line);
  });

  // The three kinds of frame that are padded rather than marked: Kuzzle's own
  // code, a Node internal, and a module. One table, because the assertion is
  // the same and only the classification differs.
  it.each([
    [
      "Kuzzle's own code",
      " at BackendController._add (/home/kuzzle/lib/core/application/backend.ts:261:28)",
    ],
    ["a Node internal", " at processImmediate (internal/timers.js:462:21)"],
    [
      "a module",
      " at Assertion.value (node_modules/should/cjs/should.js:356:19)",
    ],
  ])("pads a frame in %s", (_kind, line) => {
    expect(hilightUserCode(line)).toBe(`  ${line}`);
  });

  it("marks a frame in user code", () => {
    const line = " at registerFoo (/home/aschen/projets/app/test.ts:12:18)";

    expect(hilightUserCode(line)).toBe(`>${line}`);
  });

  // Not in the Mocha spec. `isNodeCode` is false for an `at /` frame and for an
  // `at async /` one, and those two disjuncts are the only way a bare path with
  // no function name reaches the user-code marker.
  it("marks an anonymous user frame, awaited or not", () => {
    expect(hilightUserCode(" at /home/aschen/app/test.ts:12:18")).toBe(
      "> at /home/aschen/app/test.ts:12:18",
    );
    expect(hilightUserCode(" at async /home/aschen/app/test.ts:12:18")).toBe(
      "> at async /home/aschen/app/test.ts:12:18",
    );
  });
});

describe("#removeStacktrace", () => {
  it("strips the stack outside development", () => {
    global.NODE_ENV = "production";

    const error = new Error("nope");

    expect(removeStacktrace(error).stack).toBeUndefined();
  });

  it("hilights the stack in development", () => {
    global.NODE_ENV = "development";

    const error = new Error("nope");

    expect(removeStacktrace(error).stack).toContain("nope");
  });

  // `KuzzleError` sets `stack` to undefined in its own constructor before
  // deciding what to put there, so an Error with no stack reaches this in
  // development — where it used to be `undefined.split("\n")`.
  it("accepts an Error carrying no stack in development", () => {
    global.NODE_ENV = "development";

    const error = new Error("nope");
    error.stack = undefined;

    expect(removeStacktrace(error).stack).toBeUndefined();
  });

  // The other half of the function: a serialized request response, which is
  // what the protocols actually hand it. Neither spec covered this branch.
  describe("on a serialized request response", () => {
    const response = (stack?: string) => ({
      content: { error: { message: "nope", stack } },
    });

    it("strips the stack outside development", () => {
      global.NODE_ENV = "production";

      expect(
        removeStacktrace(response("at foo (/app/x.ts:1:1)")).content.error
          .stack,
      ).toBeUndefined();
    });

    it("hilights the stack in development", () => {
      global.NODE_ENV = "development";

      expect(
        removeStacktrace(response(" at registerFoo (/home/app/test.ts:12:18)"))
          .content.error.stack,
      ).toBe("> at registerFoo (/home/app/test.ts:12:18)");
    });

    it("accepts a response carrying no stack in development", () => {
      global.NODE_ENV = "development";

      expect(removeStacktrace(response()).content.error.stack).toBeUndefined();
    });

    it("leaves a response with no error untouched", () => {
      global.NODE_ENV = "production";

      // A successful response has a `result` and no `error`, which is the
      // third arm of the function and the only one that returns `data` as-is.
      const data = { content: { result: "ok" } } as unknown as Parameters<
        typeof removeStacktrace
      >[0];

      expect(removeStacktrace(data)).toBe(data);
    });
  });
});
