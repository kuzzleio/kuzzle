import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Backend } from "../../../lib/core/backend/backend";
import { createBackend, internals } from "./backendFixture";
import { present } from "../../helpers/present";

vi.mock("../../../lib/kuzzle", async () => {
  const { FakeKuzzle } = await import("./fakeKuzzle");

  return { Kuzzle: FakeKuzzle, default: FakeKuzzle };
});

/**
 * `BackendStorage-es7.test.js` and `BackendStorage-es8.test.js` held two tests
 * each. The second was byte-identical between them — neither pins
 * `majorVersion`, so both ran the *configured* default, twice. It is stated
 * once here. The first genuinely differs, and only in how the two Elasticsearch
 * clients expose `maxRetries`: a plain property on 7, a symbol on 8.
 */
const maxRetriesOf = (
  client: Record<string | symbol, any>,
  version: "7" | "8",
) => {
  if (version === "7") {
    return client.helpers.maxRetries;
  }

  const symbol = Object.getOwnPropertySymbols(client.helpers).find(
    (s) => s.description === "max retries",
  );

  present(symbol, 'the "max retries" symbol');

  return client.helpers[symbol];
};

describe("BackendStorage", () => {
  let application: Backend;

  beforeEach(async () => {
    application = await createBackend();
    await application.start();
  });

  describe("#StorageClient", () => {
    it.each(["7", "8"] as const)(
      "constructs an ES %s client on the configured node, with the given overrides",
      (version) => {
        global.kuzzle.config.services.storageEngine.majorVersion = version;
        global.kuzzle.config.services.storageEngine.client.node = `http://es-${version}:9200`;

        expect(application.storage.StorageClient).toBeTypeOf("function");

        const client = new application.storage.StorageClient({
          maxRetries: 42,
        });

        expect(client.connectionPool.connections[0].url.toString()).toBe(
          `http://es-${version}:9200/`,
        );
        expect(maxRetriesOf(client, version)).toBe(42);
      },
    );
  });

  describe("#storageClient", () => {
    it("builds the client lazily, on first access", () => {
      global.kuzzle.config.services.storageEngine.client.node =
        "http://es:9200";

      expect(internals(application.storage)._client).toBeNull();

      expect(
        application.storage.storageClient.connectionPool.connections[0].url.toString(),
      ).toBe("http://es:9200/");

      expect(internals(application.storage)._client).not.toBeNull();
    });
  });
});
