/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2026 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// The storage driver conformance kit (ADR-0003 step 04): the test suite a
// driver's repository runs against its real engine. It registers its cases
// through the test runner's own `describe` / `it` / hooks, and asserts with
// `node:assert`, so `kuzzle` needs no test runner and loads none.

import { randomBytes } from "node:crypto";

import merge from "lodash/merge";

import defaultConfig from "../../../config/default.config";
import { storeScopeEnum } from "../storeScopeEnum";
import { capabilityCases } from "./capabilityCases";
import { ConformanceContext } from "./conformanceContext";
import { installConformanceEnvironment } from "./conformanceEnvironment";
import { coreCases } from "./coreCases";
import type { JSONObject } from "../../../types/JSONObject";
import type { StorageEngineElasticsearch } from "../../../types/config/storageEngine/StorageEngineElasticsearchConfiguration";
import type {
  StorageCapability,
  StorageDriverClass,
} from "../../../types/storage/StorageDriver";

/**
 * The test runner functions the kit registers its cases with: vitest's and
 * jest's as they are, mocha's `before` / `after` as `beforeAll` / `afterAll`.
 */
export type ConformanceTestApi = {
  describe(name: string, body: () => void): unknown;
  it(name: string, body: () => Promise<void>): unknown;
  beforeAll(body: () => Promise<void>): unknown;
  afterAll(body: () => Promise<void>): unknown;
};

export type StorageDriverConformanceOptions = {
  /** The driver class, as the package exports it */
  Driver: StorageDriverClass<unknown, StorageEngineElasticsearch>;
  /**
   * The capability groups the driver declares in its manifest: their cases
   * run, the others are skipped
   */
  capabilities: StorageCapability[];
  /**
   * `services.storageEngine` as the driver reads it, merged over Kuzzle's
   * defaults (e.g. `{ client: { node: "http://localhost:9200" } }`)
   */
  config?: JSONObject;
  test: ConformanceTestApi;
  /**
   * Prefix of the indexes the kit creates, then deletes. Each run adds a
   * random suffix.
   * @default "conformance"
   */
  indexPrefix?: string;
};

/**
 * Registers the conformance suite of a storage driver: the mandatory core,
 * and each capability group the driver declares.
 *
 * @example
 * // conformance.test.ts, in the driver's repository
 * import { afterAll, beforeAll, describe, it } from "vitest";
 * import { describeStorageDriverConformance } from "kuzzle";
 * import manifest from "../manifest.json";
 * import { MyDriver } from "../lib";
 *
 * describeStorageDriverConformance({
 *   Driver: MyDriver,
 *   capabilities: manifest.capabilities,
 *   config: { client: { node: "http://localhost:9200" } },
 *   test: { afterAll, beforeAll, describe, it },
 * });
 */
export function describeStorageDriverConformance(
  options: StorageDriverConformanceOptions,
): void {
  const { test } = options;
  const suffix = randomBytes(4).toString("hex");
  const context = new ConformanceContext(
    `${options.indexPrefix ?? "conformance"}-${suffix}`,
    new Set(options.capabilities),
  );
  let removeEnvironment: () => void = () => undefined;
  let initialized = false;

  test.describe("Storage driver conformance", () => {
    test.beforeAll(async () => {
      removeEnvironment = installConformanceEnvironment();

      const config = merge(
        structuredClone(defaultConfig.services.storageEngine),
        options.config,
      );
      const publicDriver = new options.Driver(config, storeScopeEnum.PUBLIC);
      const privateDriver = new options.Driver(config, storeScopeEnum.PRIVATE);

      await publicDriver.init();
      await privateDriver.init();
      context.setDrivers(publicDriver, privateDriver);

      await publicDriver.createIndex(context.index);
      initialized = true;
    });

    test.afterAll(async () => {
      try {
        if (initialized) {
          await context.driver.deleteIndexes([context.index]);
        }
      } finally {
        removeEnvironment();
      }
    });

    coreCases(test, context);
    capabilityCases(test, context);
  });
}
