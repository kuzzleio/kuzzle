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

import * as path from "node:path";

import type { Client as ClientES7 } from "sdk-es7";
import type { Client as ClientES8 } from "sdk-es8";

import type { StorageEngineElasticsearch } from "../../types/config/storageEngine/StorageEngineElasticsearchConfiguration";
import type { StorageDriverClass } from "../../types/storage/StorageDriver";

const PACKAGES = {
  "7": "kuzzle-storage-es-7",
  "8": "kuzzle-storage-es-8",
} as const;

/** The built-in driver of an Elasticsearch major version */
export function builtInStorageDriver(
  majorVersion: StorageEngineElasticsearch["majorVersion"],
): StorageDriverClass<ClientES7 | ClientES8, StorageEngineElasticsearch> {
  const packageName = PACKAGES[majorVersion];

  if (!packageName) {
    throw new Error("Invalid Elasticsearch version.");
  }

  provideRunningKuzzle(packageName);

  // Loaded here, not at module load: the package requires `kuzzle`, which
  // has to be loaded first.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(packageName).default;
}

/**
 * A driver package requires `kuzzle`, a peer dependency. In an application,
 * that is the running Kuzzle. When Kuzzle is itself the application (its
 * repository, its Docker image), npm installs another copy of `kuzzle` for
 * that peer dependency, whose error classes the running Kuzzle does not
 * recognize: the running Kuzzle is put in that copy's place.
 */
function provideRunningKuzzle(packageName: string): void {
  // `index.js` once built, `index.ts` when run from the sources
  const entry = path.join(__dirname, "../../../index");
  const running = require.cache[`${entry}.js`] ?? require.cache[`${entry}.ts`];
  let peer: string;

  try {
    peer = require.resolve("kuzzle", {
      paths: [path.dirname(require.resolve(packageName))],
    });
  } catch {
    return;
  }

  // Under vitest, Kuzzle is not in Node's module cache: nothing to provide
  if (running && require.cache[peer] === undefined) {
    require.cache[peer] = running;
  }
}
