import { describe, expect, it } from "vitest";

import { KuzzleError } from "../../../lib/kerror/errors/kuzzleError";
import { MultipleErrorsError } from "../../../lib/kerror/errors/multipleErrorsError";

describe("#kerror/MultipleErrorsError", () => {
  it("counts the errors it is given", () => {
    const error = new MultipleErrorsError("failed", [
      new KuzzleError("first", 400),
      new KuzzleError("second", 400),
    ]);

    expect(error.status).toBe(400);
    expect(error.count).toBe(2);
  });

  it("serializes each error it carries", () => {
    const error = new MultipleErrorsError(
      "failed",
      [new KuzzleError("first", 400, "some.error.id", 42)],
      "multiple.error.id",
      43,
    );

    const serialized = error.toJSON();

    expect(serialized.count).toBe(1);
    expect(serialized.errors).toMatchObject([
      { message: "first", id: "some.error.id", code: 42 },
    ]);
  });

  it("falls back to the raw errors when one cannot be serialized", () => {
    // `errors` is typed as KuzzleError[], but nothing enforces that at
    // runtime: an api controller collecting failures from elsewhere can hand
    // over a plain Error, which has no toJSON().
    const notAKuzzleError = new Error("plain") as unknown as KuzzleError;

    const error = new MultipleErrorsError("failed", [notAKuzzleError]);

    const serialized = error.toJSON();

    expect(serialized.count).toBe(1);
    expect(serialized.errors).toEqual([notAKuzzleError]);
  });
});
