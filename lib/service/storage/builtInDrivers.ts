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

// The built-in Elasticsearch 7 and 8 drivers (ADR-0003 step 06): the
// packages `kuzzle-storage-es-7` and `kuzzle-storage-es-8`, dependencies of
// Kuzzle at pinned versions. Dropped from Kuzzle's dependencies at the next
// major.

import type { Client as ClientES7 } from "sdk-es7";
import type { Client as ClientES8 } from "sdk-es8";

import * as kerror from "../../kerror";
import type { StorageEngineElasticsearch } from "../../types/config/storageEngine/StorageEngineElasticsearchConfiguration";
import type { StorageDriverClass } from "../../types/storage/StorageDriver";
import { notFoundDetail, provideRunningKuzzle } from "./driverPackage";

const driverError = kerror.wrap("services", "storage_driver");

const PACKAGES = {
  "7": "kuzzle-storage-es-7",
  "8": "kuzzle-storage-es-8",
} as const;

/**
 * The package of the built-in driver of an Elasticsearch major version,
 * `undefined` for an unknown one
 */
export function builtInStorageDriverPackage(
  majorVersion: StorageEngineElasticsearch["majorVersion"],
): string | undefined {
  return Object.hasOwn(PACKAGES, majorVersion)
    ? PACKAGES[majorVersion]
    : undefined;
}

/**
 * The built-in driver of an Elasticsearch major version
 *
 * @throws {services.storage_driver.unsupported_major_version} if no built-in
 *   driver supports it: Kuzzle does not start
 * @throws {services.storage_driver.not_found} if its package is not
 *   installed: Kuzzle does not start
 */
export function builtInStorageDriver(
  majorVersion: StorageEngineElasticsearch["majorVersion"],
): StorageDriverClass<ClientES7 | ClientES8, StorageEngineElasticsearch> {
  const packageName = builtInStorageDriverPackage(majorVersion);

  if (packageName === undefined) {
    throw driverError.get(
      "unsupported_major_version",
      String(majorVersion),
      Object.keys(PACKAGES).join(", "),
    );
  }

  let entry: string;

  try {
    entry = require.resolve(packageName);
  } catch (error) {
    throw driverError.get(
      "not_found",
      packageName,
      notFoundDetail(packageName, error),
    );
  }

  provideRunningKuzzle(entry);

  // Loaded here, not at module load: the package requires `kuzzle`, which
  // has to be loaded first.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(entry).default;
}
