import { beforeEach, describe, expect, it, vi } from "vitest";

import PassportResponse from "../../../lib/core/auth/passportResponse";

describe("#core/auth/PassportResponse", () => {
  let response: PassportResponse;

  /*
   * The Mocha spec built one instance in a `before` and let the two tests
   * share it — the header set by the first was still there for the second.
   * Nothing depended on that, and a fixture per test is what makes the
   * statusCode assertion below readable.
   */
  beforeEach(() => {
    response = new PassportResponse();
  });

  it("stores a header and reads it back", () => {
    response.setHeader("field", "myValue");

    expect(response.getHeader("field")).toBe("myValue");
  });

  it("calls the end listener once one is registered", () => {
    const endListener = vi.fn();

    response.addEndListener(endListener);
    response.end(42);

    expect(endListener).toHaveBeenCalledOnce();
    // The argument `end` was given: the Mocha spec passed 42 and asserted
    // nothing about it, so the only thing that used it went untested.
    expect(response.statusCode).toBe(42);
  });

  it("keeps the default status code when end() is given none", () => {
    response.end();

    expect(response.statusCode).toBe(200);
  });
});
