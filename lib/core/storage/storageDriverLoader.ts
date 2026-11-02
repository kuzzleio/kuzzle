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
import {
  notFoundDetail,
  provideRunningKuzzle,
} from "../../service/storage/driverPackage";
import type { JSONObject } from "../../types/JSONObject";
import type { StorageEngineElasticsearch } from "../../types/config/storageEngine/StorageEngineElasticsearchConfiguration";
import {
  STORAGE_CAPABILITIES,
  type StorageCapability,
  type StorageDriver,
  type StorageDriverClass,
  type StorageDriverCore,
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

/**
 * Every method of the core contract, checked off against `StorageDriverCore`
 * by the compiler: a method missing here or unknown to it does not build.
 */
const CORE_METHOD_SET: Readonly<Record<keyof StorageDriverCore, true>> = {
  count: true,
  create: true,
  createCollection: true,
  createIndex: true,
  createOrReplace: true,
  delete: true,
  deleteByQuery: true,
  deleteCollection: true,
  deleteFields: true,
  deleteIndex: true,
  deleteIndexes: true,
  exists: true,
  get: true,
  getMapping: true,
  getSchema: true,
  getSettings: true,
  import: true,
  info: true,
  init: true,
  mCreate: true,
  mCreateOrReplace: true,
  mDelete: true,
  mExecute: true,
  mExists: true,
  mGet: true,
  mReplace: true,
  mUpdate: true,
  mUpsert: true,
  refreshCollection: true,
  replace: true,
  scroll: true,
  search: true,
  translateKoncordeFilters: true,
  truncateCollection: true,
  update: true,
  upsert: true,
};

/** The methods every driver must have */
export const CORE_METHODS: readonly (keyof StorageDriverCore)[] = Object.freeze(
  Object.keys(CORE_METHOD_SET).filter(isCoreMethod),
);

function isCoreMethod(key: string): key is keyof StorageDriverCore {
  return Object.hasOwn(CORE_METHOD_SET, key);
}

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
  /** The directory an external driver is loaded from, `null` for a built-in one */
  location: string | null;
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
 * Checks that a driver instance has the methods of the core contract, and
 * those of the capabilities its driver declares: at startup, rather than
 * with a `TypeError` on the first request needing a missing one. Done on the
 * instance rather than on the class: a method can be an instance property.
 *
 * @throws {services.storage_driver.invalid_driver}
 */
export function assertDriverContract(
  driver: StorageDriver,
  { capabilities, description }: SelectedStorageDriver,
): void {
  const missing = CORE_METHODS.filter(
    (method) => typeof driver[method] !== "function",
  );

  if (missing.length > 0) {
    throw driverError.get(
      "invalid_driver",
      description,
      `it lacks ${missing.length === 1 ? "a method" : "methods"} of the core contract: ${missing.join(", ")}`,
    );
  }

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
    location: null,
  };
}

/**
 * An npm package name, scoped or not: no path, no version, no subpath
 * (rules of validate-npm-package-name, upper case allowed for older packages)
 */
const PACKAGE_NAME =
  /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/i;

function loadExternalDriver(name: unknown): SelectedStorageDriver {
  assertPackageName(name);

  const lookup = [process.cwd(), __dirname];
  const entry = resolveDriver(name, lookup);
  const { packageName, root, version } = findPackageRoot(name, entry);
  const capabilities = readManifest(name, root);
  const identity = `${packageName}@${version}`;

  // Before the driver's code requires `kuzzle`
  provideRunningKuzzle(entry);

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
    // An npm alias (`npm install <alias>@npm:<package>`) shows both names
    description: name === packageName ? identity : `${name} (${identity})`,
    identity,
    location: root,
  };
}

/** @throws {services.storage_driver.not_found} */
function assertPackageName(name: unknown): asserts name is string {
  if (typeof name !== "string" || name.length === 0) {
    throw driverError.get(
      "not_found",
      String(name),
      "services.storageEngine.driver must be an npm package name",
    );
  }

  if (PACKAGE_NAME.test(name)) {
    return;
  }

  throw driverError.get(
    "not_found",
    name,
    name.startsWith(".") || path.isAbsolute(name) || name.includes("\\")
      ? `services.storageEngine.driver must be an npm package name, not a path: install the driver (npm install ${name}), then set its package name`
      : "services.storageEngine.driver must be an npm package name, without a version or a subpath",
  );
}

/**
 * Looked up from the current directory first, as the `.kuzzlerc` file is,
 * then from Kuzzle itself: the application installs the driver next to
 * `kuzzle`, which Kuzzle's own location finds whatever the current
 * directory.
 *
 * @throws {services.storage_driver.not_found}
 */
function resolveDriver(name: string, lookup: string[]): string {
  try {
    return require.resolve(name, { paths: lookup });
  } catch (error) {
    const installed = findInstalledVersion(name, lookup);

    throw driverError.get(
      "not_found",
      name,
      installed === null
        ? notFoundDetail(name, error)
        : `installed ${name}@${installed} has no entry point`,
    );
  }
}

/**
 * The version of a package installed in a `node_modules` directory Node
 * looks into from `lookup`, which `require.resolve` could not load anyway: a
 * package without an entry point, like a name-reservation placeholder.
 */
function findInstalledVersion(name: string, lookup: string[]): string | null {
  for (const start of lookup) {
    let dir = start;

    while (true) {
      const pkg = readJsonQuietly(
        path.join(dir, "node_modules", name, "package.json"),
      );

      if (pkg !== null) {
        return String(pkg.version);
      }

      const parent = path.dirname(dir);

      if (parent === dir) {
        break;
      }

      dir = parent;
    }
  }

  return null;
}

/**
 * The directory of the driver's own `package.json`, found from its entry
 * point: `<name>/package.json` cannot be resolved when the package's
 * `exports` does not list it. Under an npm alias, that `package.json` names
 * the aliased package, and the directory is `node_modules/<alias>`.
 *
 * @throws {services.storage_driver.not_found}
 */
function findPackageRoot(
  name: string,
  entry: string,
): { packageName: string; root: string; version: string } {
  const aliasDir = path.sep + path.join("node_modules", name);
  let dir = path.dirname(entry);

  while (true) {
    const pkg = readJson(path.join(dir, "package.json"));

    if (
      typeof pkg?.name === "string" &&
      (pkg.name === name || dir.endsWith(aliasDir))
    ) {
      return {
        packageName: pkg.name,
        root: dir,
        version: String(pkg.version),
      };
    }

    const parent = path.dirname(dir);

    if (parent === dir) {
      throw driverError.get(
        "not_found",
        name,
        `${entry} belongs to no package named "${name}"`,
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
      manifestError(manifestPath, error),
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

/** The path once: Node's file system errors repeat it */
function manifestError(manifestPath: string, error: unknown): string {
  if (error instanceof SyntaxError) {
    return `${manifestPath} is not valid JSON: ${error.message}`;
  }

  const code =
    error instanceof Error && "code" in error ? String(error.code) : null;

  if (code === "ENOENT") {
    return `${manifestPath} does not exist`;
  }

  return `cannot read ${manifestPath}${code === null ? `: ${messageOf(error)}` : ` (${code})`}`;
}

/** Typed for a lookup of any manifest value */
const KNOWN_CAPABILITIES: ReadonlySet<unknown> = new Set(STORAGE_CAPABILITIES);

function isStorageCapability(value: unknown): value is StorageCapability {
  return KNOWN_CAPABILITIES.has(value);
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
 * instances is checked once they exist (`assertDriverContract`).
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

/** The parsed file, or `null` when it cannot be read or parsed */
function readJsonQuietly(file: string): JSONObject | null {
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
