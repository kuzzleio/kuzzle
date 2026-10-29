import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadConfig } from "../../../lib/config";
import { storeScopeEnum } from "../../../lib/core/storage/storeScopeEnum";
import { StorageService } from "../../../lib/service/storage/storageService";
import type { StorageEngineElasticsearch } from "../../../lib/types/config/storageEngine/StorageEngineElasticsearchConfiguration";
import type { StorageDriverClass } from "../../../lib/types/storage/StorageDriver";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

describe("StorageService", () => {
  const init = vi.fn(async () => undefined);
  const built: unknown[][] = [];
  const Driver = vi.fn(function FakeDriver(...args: unknown[]) {
    built.push(args);

    return { init };
  }) as unknown as StorageDriverClass<unknown, StorageEngineElasticsearch>;
  const config = structuredClone(loadConfig().services.storageEngine);

  beforeEach(() => {
    built.length = 0;
    init.mockReset().mockResolvedValue(undefined);
    stubKuzzle({
      config: { services: { common: { defaultInitTimeout: 10 } } },
    });
  });

  afterEach(() => {
    restoreKuzzle();
  });

  it("builds the scope's driver instance from the configuration", () => {
    const service = new StorageService(Driver, config, storeScopeEnum.PRIVATE);

    expect(built).toEqual([[config, storeScopeEnum.PRIVATE]]);
    expect(service.driver.init).toBe(init);
  });

  it("initializes the driver", async () => {
    const service = new StorageService(Driver, config, storeScopeEnum.PUBLIC);

    await service.init();

    expect(init).toHaveBeenCalledOnce();
  });

  it("fails as the Elasticsearch service did when the driver outlives the init timeout", async () => {
    init.mockReturnValue(new Promise<undefined>(() => {}));
    const service = new StorageService(Driver, config, storeScopeEnum.PUBLIC);

    await expect(service.init()).rejects.toMatchObject({
      id: "core.fatal.service_timeout",
      message: expect.stringContaining("elasticsearch"),
    });
  });
});
