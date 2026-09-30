import { describe, expect, it } from "vitest";

import { assertIsAuthenticated } from "../../lib/util/requestAssertions";
import type { KuzzleRequest } from "../../lib/api/request";

const requestWithUser = (user: unknown): KuzzleRequest =>
  ({ context: { user } }) as KuzzleRequest;

describe("#assertIsAuthenticated", () => {
  it("accepts a user that is not the anonymous one", () => {
    expect(() =>
      assertIsAuthenticated("-1", requestWithUser({ _id: "gordon" })),
    ).not.toThrow();
  });

  it("rejects the anonymous user", () => {
    expect(() =>
      assertIsAuthenticated("-1", requestWithUser({ _id: "-1" })),
    ).toThrow(/authentication required/i);
  });

  // `context.user` is null until the request has been authenticated, which is
  // exactly what this assertion exists to reject — it used to answer with a
  // TypeError on `null._id` instead of the intended error.
  it("rejects a request with no user at all", () => {
    expect(() => assertIsAuthenticated("-1", requestWithUser(null))).toThrow(
      /authentication required/i,
    );
  });
});
