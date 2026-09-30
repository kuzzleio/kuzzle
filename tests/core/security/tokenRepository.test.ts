import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TokenRepository } from "../../../lib/core/security/tokenRepository";
import { restoreKuzzle, stubAsk, stubKuzzle } from "../../mocks/kuzzle";

describe("#core/security/TokenRepository", () => {
  beforeEach(() => {
    const bus = stubAsk(() => undefined);

    stubKuzzle({
      ask: bus.ask,
      config: {
        repositories: { common: { cacheTTL: 1440000 } },
        security: {
          authToken: {},
          // The deprecated section `authToken` falls back to. Its type is
          // optional (as v2.56.0 declared it); the packaged defaults ship it.
          jwt: { gracePeriod: 1234.6 },
        },
      },
      internalIndex: { index: "%kuzzle" },
      onAsk: bus.onAsk,
    });
  });

  afterEach(() => {
    restoreKuzzle();
  });

  it("takes its grace period from the deprecated jwt section, floored", () => {
    const repository = new TokenRepository();

    expect(Reflect.get(repository, "tokenGracePeriod")).toBe(1234);
  });
});
