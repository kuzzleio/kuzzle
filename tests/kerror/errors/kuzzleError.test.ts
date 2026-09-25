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

  // v2.56.0's subclasses took untyped arguments, so a TypeScript consumer
  // may hand one a caught `unknown`; `Error` stringifies it, and so do we.
  it("stringifies a message that is neither a string nor an Error", () => {
    expect(new KuzzleError(42, 500).message).toEqual("42");
    expect(new KuzzleError(null, 500).message).toEqual("");
  });

  // `code`, `id` and `props` are declared as always present (as v2.56.0
  // declared them) but a hand-built error leaves them undefined — as own
  // properties, as they always were.
  it("keeps code, id and props as own properties, undefined when not given", () => {
    const err = new KuzzleError("foobar", 500);

    expect(Object.keys(err)).toEqual(["status", "code", "id", "props"]);
    expect(err.code).toBeUndefined();
    expect(err.id).toBeUndefined();
    expect(err.props).toBeUndefined();
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
