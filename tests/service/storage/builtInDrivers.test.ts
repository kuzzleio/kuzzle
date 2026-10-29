import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Client as ClientES7 } from "sdk-es7";
import { Client as ClientES8 } from "sdk-es8";

import { loadConfig } from "../../../lib/config";
import { storeScopeEnum } from "../../../lib/core/storage/storeScopeEnum";
import { ES7 } from "../../../lib/service/storage/7/elasticsearch";
import { ES8 } from "../../../lib/service/storage/8/elasticsearch";
import {
  ES7Driver,
  ES8Driver,
  builtInStorageDriver,
} from "../../../lib/service/storage/builtInDrivers";
import type { StorageEngineElasticsearch } from "../../../lib/types/config/storageEngine/StorageEngineElasticsearchConfiguration";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

describe("built-in storage drivers", () => {
  let config: StorageEngineElasticsearch;

  beforeEach(() => {
    // The classes read the real defaults at construction (`_loadMsConfig`).
    const kuzzleConfig = structuredClone(loadConfig());

    config = kuzzleConfig.services.storageEngine;
    stubKuzzle({ config: kuzzleConfig });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreKuzzle();
  });

  describe.each([
    ["7" as const, ES7Driver, ES7, ClientES7],
    ["8" as const, ES8Driver, ES8, ClientES8],
  ])("Elasticsearch %s", (majorVersion, Driver, Base, Client) => {
    it("is the driver of its major version", () => {
      expect(builtInStorageDriver(majorVersion)).toBe(Driver);
    });

    it("is today's class, unchanged", () => {
      const driver = new Driver(config, storeScopeEnum.PRIVATE);

      expect(driver).toBeInstanceOf(Base);
      expect(driver.scope).toBe(storeScopeEnum.PRIVATE);
    });

    it("connects through the class's init sequence", async () => {
      const driver = new Driver(config, storeScopeEnum.PUBLIC);
      const initSequence = vi
        .spyOn(driver, "_initSequence")
        .mockResolvedValue(undefined);

      await driver.init();

      expect(initSequence).toHaveBeenCalledOnce();
    });

    it("builds a new native client from a client configuration", () => {
      const client = Driver.createNativeClient({ node: "http://es:9200" });

      expect(client).toBeInstanceOf(Client);
      expect(client.connectionPool.connections[0].url.toString()).toBe(
        "http://es:9200/",
      );
      expect(Driver.createNativeClient({ node: "http://es:9200" })).not.toBe(
        client,
      );
    });
  });

  it("refuses an unknown major version", () => {
    expect(() =>
      builtInStorageDriver("6" as StorageEngineElasticsearch["majorVersion"]),
    ).toThrow("Invalid Elasticsearch version.");
  });
});
