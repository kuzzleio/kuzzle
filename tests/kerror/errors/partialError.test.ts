import { describe, expect, it } from "vitest";

import { invalid } from "../../helpers/invalid";

import { PartialError } from "../../../lib/kerror/errors";

describe("#PartialError", () => {
  it("creates a well-formed object with no body provided", () => {
    const err = new PartialError("foobar");

    expect(err.message).toEqual("foobar");
    expect(err.status).toEqual(206);
    expect(err.name).toEqual("PartialError");
    expect(Array.isArray(err.errors)).toBe(true);
    expect(err.errors).toHaveLength(0);
    expect(err.count).toEqual(0);
  });

  it("creates a well-formed object with a body provided", () => {
    const err = new PartialError("foobar", invalid(["foo", "bar"]));

    expect(err.message).toEqual("foobar");
    expect(err.status).toEqual(206);
    expect(err.name).toEqual("PartialError");
    expect(err.errors).toEqual(["foo", "bar"]);
    expect(err.count).toEqual(2);
  });

  it("builds with no arguments at all", () => {
    const err = new PartialError();

    expect(err.message).toEqual("");
    expect(err.status).toEqual(206);
    expect(Array.isArray(err.errors)).toBe(true);
    expect(err.errors).toHaveLength(0);
  });

  it("accepts the shifted (message, id, code) form", () => {
    const err = new PartialError("foobar", "some.error.id", 42);

    expect(err.message).toEqual("foobar");
    expect(err.status).toEqual(206);
    expect(err.id).toEqual("some.error.id");
    expect(err.code).toEqual(42);
    expect(Array.isArray(err.errors)).toBe(true);
    expect(err.errors).toHaveLength(0);
    expect(err.count).toEqual(0);
  });

  it("serializes correctly", () => {
    const err = JSON.parse(
      JSON.stringify(new PartialError("foobar", invalid(["foo", "bar"]))),
    );

    expect(err.message).toEqual("foobar");
    expect(err.status).toEqual(206);
    expect(err.errors).toEqual(["foo", "bar"]);
    expect(err.count).toEqual(2);
  });
});
