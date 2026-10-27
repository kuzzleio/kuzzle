import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TokenRepository } from "../../../lib/core/security/tokenRepository";
import type { JSONObject } from "../../../lib/types/JSONObject";
import { restoreKuzzle, stubAsk, stubKuzzle } from "../../mocks/kuzzle";

describe("#core/security/TokenRepository", () => {
  let kuzzle: JSONObject;

  function stub(security: JSONObject, internal: JSONObject = {}) {
    const bus = stubAsk(() => undefined);

    kuzzle = stubKuzzle({
      ask: bus.ask,
      config: {
        internal,
        repositories: { common: { cacheTTL: 1440000 } },
        security,
      },
      internalIndex: { index: "%kuzzle" },
      onAsk: bus.onAsk,
    });
  }

  beforeEach(() => {
    stub({ authToken: {}, jwt: { gracePeriod: 1234.6 } });
  });

  afterEach(() => {
    restoreKuzzle();
  });

  it("falls back to the deprecated jwt section for its grace period, floored", () => {
    const repository = new TokenRepository();

    expect(Reflect.get(repository, "tokenGracePeriod")).toBe(1234);
  });

  // Up to 2.59, only `jwt.gracePeriod` was read: `authToken.gracePeriod`
  // was silently ignored.
  it("takes its grace period from security.authToken", () => {
    stub({ authToken: { gracePeriod: 5000 }, jwt: {} });

    const repository = new TokenRepository();

    expect(Reflect.get(repository, "tokenGracePeriod")).toBe(5000);
  });

  // The one setting where jwt keeps winning, as it did: see LEGACY_FIRST.
  it("keeps the jwt grace period when both sections set one", () => {
    stub({ authToken: { gracePeriod: 5000 }, jwt: { gracePeriod: 1234 } });

    const repository = new TokenRepository();

    expect(Reflect.get(repository, "tokenGracePeriod")).toBe(1234);
  });

  it("warns about the security.jwt settings the configuration sets", () => {
    stub(
      { authToken: {}, jwt: { gracePeriod: 1234 } },
      { deprecatedSettings: ["security.jwt.gracePeriod"] },
    );

    expect(new TokenRepository()).toBeInstanceOf(TokenRepository);

    expect(kuzzle.log.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        '"security.jwt" is deprecated, use "security.authToken" instead (set: security.jwt.gracePeriod)',
      ),
    );
  });

  it("does not warn when security.jwt is left alone", () => {
    expect(new TokenRepository()).toBeInstanceOf(TokenRepository);

    expect(kuzzle.log.warn).not.toHaveBeenCalled();
  });
});
