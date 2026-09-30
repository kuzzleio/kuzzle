import { describe, expect, it } from "vitest";

import { ExternalServiceError } from "../../../lib/kerror/errors";

describe("#ExternalServiceError", () => {
  it("creates a well-formed object", () => {
    const err = new ExternalServiceError("foobar");

    expect(err.message).toEqual("foobar");
    expect(err.status).toEqual(500);
    expect(err.name).toEqual("ExternalServiceError");
  });

  it("serializes correctly", () => {
    const err = JSON.parse(JSON.stringify(new ExternalServiceError("foobar")));

    expect(err.message).toEqual("foobar");
    expect(err.status).toEqual(500);
  });
});
