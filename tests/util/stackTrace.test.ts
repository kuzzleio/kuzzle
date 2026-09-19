import { afterEach, describe, expect, it } from "vitest";

import { removeStacktrace } from "../../lib/util/stackTrace";

const NODE_ENV = global.NODE_ENV;

afterEach(() => {
  global.NODE_ENV = NODE_ENV;
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
});
