import { afterEach, describe, expect, it } from "vitest";

import { authTokenSetting } from "../../../lib/core/security/authTokenSettings";
import type { JSONObject } from "../../../lib/types/JSONObject";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/**
 * `security.jwt` is the deprecated spelling of `security.authToken`. Both
 * ship the same non-null defaults, so `authToken.x ?? jwt.x` never reached a
 * `jwt` value: a user still setting `jwt.expiresIn` was silently ignored.
 */
describe("#core/security/authTokenSetting", () => {
  const defaults = {
    algorithm: "HS256",
    expiresIn: "1h",
    gracePeriod: 1000,
    maxTTL: -1,
    secret: null,
  };

  function stub(authToken: JSONObject, jwt: JSONObject | undefined) {
    stubKuzzle({
      config: {
        security: {
          authToken: { ...defaults, ...authToken },
          jwt: jwt && { ...defaults, ...jwt },
        },
      },
    });
  }

  afterEach(() => {
    restoreKuzzle();
  });

  it("answers the packaged default when nothing is set", () => {
    stub({}, {});

    expect(authTokenSetting("expiresIn")).toBe("1h");
    expect(authTokenSetting("secret")).toBeNull();
  });

  it("answers a value set under security.authToken", () => {
    stub({ expiresIn: "2h" }, {});

    expect(authTokenSetting("expiresIn")).toBe("2h");
  });

  it("falls back to a value set under the deprecated security.jwt", () => {
    stub({}, { expiresIn: "3h", maxTTL: 7200000, algorithm: "HS512" });

    expect(authTokenSetting("expiresIn")).toBe("3h");
    expect(authTokenSetting("maxTTL")).toBe(7200000);
    expect(authTokenSetting("algorithm")).toBe("HS512");
  });

  it("prefers security.authToken when both are set", () => {
    stub({ expiresIn: "2h", secret: "a" }, { expiresIn: "3h", secret: "b" });

    expect(authTokenSetting("expiresIn")).toBe("2h");
    expect(authTokenSetting("secret")).toBe("a");
  });

  // `gracePeriod` used to be read from jwt only: set in both, jwt still wins.
  it("prefers security.jwt for a gracePeriod set in both sections", () => {
    stub({ gracePeriod: 3000 }, { gracePeriod: 5000 });

    expect(authTokenSetting("gracePeriod")).toBe(5000);
  });

  it("answers a gracePeriod set under security.authToken only", () => {
    stub({ gracePeriod: 3000 }, {});

    expect(authTokenSetting("gracePeriod")).toBe(3000);
  });

  it("treats a null authToken value as unset", () => {
    stub({ secret: null }, { secret: "from-jwt" });

    expect(authTokenSetting("secret")).toBe("from-jwt");
  });

  it("works without a security.jwt section", () => {
    stub({ gracePeriod: 42 }, undefined);

    expect(authTokenSetting("gracePeriod")).toBe(42);
    expect(authTokenSetting("expiresIn")).toBe("1h");
  });
});
