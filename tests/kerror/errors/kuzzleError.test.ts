import { describe, expect, it } from "vitest";

import { KuzzleError } from "../../../lib/kerror/errors";

describe("#ExternalServiceError", () => {
  it("creates a well-formed object", () => {
    const err = new KuzzleError("foobar", 500);

    expect(err.message).toEqual("foobar");
    expect(err.status).toEqual(500);
    expect(err.name).toEqual("KuzzleError");
    expect(typeof err.stack).toBe("string");
  });

  it("derives from a previous error", () => {
    const orig = new Error("foo"),
      err = new KuzzleError(orig, 500);

    expect(err.message).toEqual(orig.message);
    expect(err.status).toEqual(500);
    expect(err.name).toEqual("KuzzleError");
    expect(err.stack).toEqual(orig.stack);
  });

  // `doc/build-error-codes.js` constructs one of each class with no arguments
  // just to read its `status`, and plugin code in JavaScript may do the same.
  // The typed constructor has to keep accepting that.
  it("builds with no message at all", () => {
    const err = new KuzzleError(undefined, 500);

    expect(err.message).toEqual("");
    expect(err.status).toEqual(500);
  });

  it("serializes correctly", () => {
    const err = new KuzzleError("foobar", 500, "ohnoes", 123),
      serialized = JSON.parse(JSON.stringify(err));

    expect(serialized.message).toEqual("foobar");
    expect(serialized.status).toEqual(500);
    expect(serialized.code).toEqual(123);
    expect(serialized.id).toEqual("ohnoes");
  });
});
