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

// The storage driver loader (ADR-0003 step 03): selects the driver class the
// storage layer runs on. `services.storageEngine.driver` names an npm package,
// whose manifest is checked before its code is loaded; without it, the
// built-in Elasticsearch driver of `majorVersion` is selected, as before.

import { readFileSync } from "node:fs";
import * as path from "node:path";
import * as semver from "semver";

import * as kerror from "../../kerror";
import { builtInStorageDriver } from "../../service/storage/builtInDrivers";
import type { JSONObject } from "../../types/JSONObject";
import type { StorageEngineElasticsearch } from "../../types/config/storageEngine/StorageEngineElasticsearchConfiguration";
import {
  STORAGE_CAPABILITIES,
  type StorageCapability,
  type StorageDriver,
  type StorageDriverClass,
  type StorageMappingUpdates,
  type StorageStatsCapability,
  type StorageUpdateByQuery,
} from "../../types/storage/StorageDriver";
import "../../types/Global";

const driverError = kerror.wrap("services", "storage_driver");

/** The methods of the optional capability groups */
export type CapabilityMethod = keyof (StorageMappingUpdates &
  StorageStatsCapability &
  StorageUpdateByQuery);

/** The methods a driver declaring a capability must have */
export const CAPABILITY_METHODS: Readonly<
  Record<StorageCapability, readonly CapabilityMethod[]>
> = Object.freeze({
  // A search body option, not a method
  aggregations: [],
  mappingUpdates: ["updateMapping", "updateCollection"],
  stats: ["stats"],
  updateByQuery: ["updateByQuery", "bulkUpdateByQuery"],
});

export type SelectedStorageDriver = {
  Driver: StorageDriverClass<unknown, StorageEngineElasticsearch>;
  /** The capability groups the driver declares */
  capabilities: ReadonlySet<StorageCapability>;
  /**
   * `<package name>@<version>` of an external driver, `null` for a built-in
   * one: what the cluster nodes compare at join.
   */
  identity: string | null;
  /** The selected driver, for the logs */
  description: string;
};

/** The built-in drivers implement every capability */
const BUILT_IN_CAPABILITIES: ReadonlySet<StorageCapability> = new Set(
  STORAGE_CAPABILITIES,
);

/**
 * Keyed by the configuration object: the two storage scopes, the cluster and
 * the raw client surfaces all select the same driver, loaded once.
 */
const selected = new WeakMap<
  StorageEngineElasticsearch,
  SelectedStorageDriver
>();

/**
 * The driver class `services.storageEngine` selects.
 *
 * @throws {services.storage_driver.*} if the configured driver cannot be
 *   loaded: Kuzzle does not start
 */
export function selectStorageDriver(
  config: StorageEngineElasticsearch,
): SelectedStorageDriver {
  let driver = selected.get(config);

  if (driver === undefined) {
    driver =
      config.driver === undefined
        ? selectBuiltInDriver(config)
        : loadExternalDriver(config.driver);

    selected.set(config, driver);
  }

  return driver;
}

/**
 * A new native client of the configured engine, for
 * `app.storage.storageClient`, `app.storage.StorageClient` and
 * `context.constructors.ESClient`.
 */
export function createNativeStorageClient(
  config: StorageEngineElasticsearch,
  clientConfig: JSONObject,
): unknown {
  return selectStorageDriver(config).Driver.createNativeClient(clientConfig);
}

/**
 * Checks that a driver instance has the methods of the capabilities its
 * driver declares. Done on the instance rather than on the class: a method
 * can be an instance property.
 *
 * @throws {services.storage_driver.invalid_driver}
 */
export function assertDeclaredCapabilities(
  driver: StorageDriver,
  { capabilities, description }: SelectedStorageDriver,
): void {
  for (const capability of capabilities) {
    for (const method of CAPABILITY_METHODS[capability]) {
      if (typeof driver[method] !== "function") {
        throw driverError.get(
          "invalid_driver",
          description,
          `it declares the "${capability}" capability but has no "${method}" method`,
        );
      }
    }
  }
}

function selectBuiltInDriver(
  config: StorageEngineElasticsearch,
): SelectedStorageDriver {
  // Without a `majorVersion`, the raw client surfaces have always built an
  // Elasticsearch 7 client.
  const majorVersion = config.majorVersion ?? "7";

  return {
    Driver: builtInStorageDriver(majorVersion),
    capabilities: BUILT_IN_CAPABILITIES,
    description: `the built-in Elasticsearch ${majorVersion} driver`,
    identity: null,
  };
}

function loadExternalDriver(name: unknown): SelectedStorageDriver {
  if (typeof name !== "string" || name.length === 0) {
    throw driverError.get(
      "not_found",
      String(name),
      "services.storageEngine.driver must be an npm package name",
    );
  }

  const entry = resolveDriver(name);
  const { root, version } = findPackageRoot(name, entry);
  const capabilities = readManifest(name, root);
  const identity = `${name}@${version}`;

  let exported: unknown;

  try {
    // The package the configuration names: only known at runtime.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    exported = require(entry);
  } catch (error) {
    throw driverError.get("invalid_driver", identity, messageOf(error));
  }

  return {
    Driver: driverClass(identity, exported),
    capabilities,
    description: identity,
    identity,
  };
}

/**
 * Looked up from the application first, then from Kuzzle itself: the
 * application is what installs the driver, next to `kuzzle`.
 */
function resolveDriver(name: string): string {
  try {
    return require.resolve(name, { paths: [process.cwd(), __dirname] });
  } catch (error) {
    throw driverError.get("not_found", name, messageOf(error));
  }
}

/**
 * The directory of the driver's own `package.json`, found from its entry
 * point: `<name>/package.json` cannot be resolved when the package's
 * `exports` does not list it.
 */
function findPackageRoot(
  name: string,
  entry: string,
): { root: string; version: string } {
  let dir = path.dirname(entry);

  while (true) {
    const pkg = readJson(path.join(dir, "package.json"));

    if (pkg?.name === name) {
      return { root: dir, version: String(pkg.version) };
    }

    const parent = path.dirname(dir);

    if (parent === dir) {
      throw driverError.get(
        "not_found",
        name,
        `no package.json named "${name}" above ${entry}`,
      );
    }

    dir = parent;
  }
}

/**
 * @returns The capabilities the manifest declares
 * @throws {services.storage_driver.invalid_manifest}
 * @throws {services.storage_driver.version_mismatch}
 */
function readManifest(name: string, root: string): Set<StorageCapability> {
  const manifestPath = path.join(root, "manifest.json");
  let manifest: JSONObject | null;

  try {
    manifest = readJson(manifestPath, { required: true });
  } catch (error) {
    throw driverError.get(
      "invalid_manifest",
      name,
      `cannot read ${manifestPath}: ${messageOf(error)}`,
    );
  }

  const { capabilities, kuzzleVersion } = manifest ?? {};

  if (
    typeof kuzzleVersion !== "string" ||
    semver.validRange(kuzzleVersion) === null
  ) {
    throw driverError.get(
      "invalid_manifest",
      name,
      '"kuzzleVersion" must be a semver range',
    );
  }

  const current = global.kuzzle.config.version!;

  if (!semver.satisfies(current, kuzzleVersion, { includePrerelease: true })) {
    throw driverError.get("version_mismatch", name, kuzzleVersion, current);
  }

  if (!Array.isArray(capabilities)) {
    throw driverError.get(
      "invalid_manifest",
      name,
      '"capabilities" must be an array',
    );
  }

  const declared = new Set<StorageCapability>();

  for (const capability of capabilities) {
    if (!isStorageCapability(capability)) {
      throw driverError.get(
        "invalid_manifest",
        name,
        `unknown capability "${capability}" (known: ${STORAGE_CAPABILITIES.join(", ")})`,
      );
    }

    declared.add(capability);
  }

  return declared;
}

function isStorageCapability(value: unknown): value is StorageCapability {
  return STORAGE_CAPABILITIES.some((capability) => capability === value);
}

/** The class a driver package exports, as its module or its `default` */
function driverClass(
  identity: string,
  exported: unknown,
): SelectedStorageDriver["Driver"] {
  const candidate =
    typeof exported === "object" && exported !== null && "default" in exported
      ? exported.default
      : exported;

  if (!isDriverClass(candidate)) {
    throw driverError.get(
      "invalid_driver",
      identity,
      "the package must export a storage driver class, with a static createNativeClient()",
    );
  }

  return candidate;
}

/**
 * What can be checked of a class before building it: the contract of its
 * instances is checked once they exist (`assertDeclaredCapabilities`).
 */
function isDriverClass(
  value: unknown,
): value is SelectedStorageDriver["Driver"] {
  return (
    typeof value === "function" &&
    "createNativeClient" in value &&
    typeof value.createNativeClient === "function"
  );
}

/**
 * @returns The parsed file, or `null` when it does not exist and is not
 *   `required`
 */
function readJson(file: string, { required = false } = {}): JSONObject | null {
  let content: string;

  try {
    content = readFileSync(file, "utf8");
  } catch (error) {
    if (
      !required &&
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }

  return JSON.parse(content);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
