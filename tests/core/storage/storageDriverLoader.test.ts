import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Client as ClientES7 } from "sdk-es7";
import { Client as ClientES8 } from "sdk-es8";

import { loadConfig } from "../../../lib/config";
import {
  assertDeclaredCapabilities,
  createNativeStorageClient,
  selectStorageDriver,
  type SelectedStorageDriver,
} from "../../../lib/core/storage/storageDriverLoader";
import {
  ES7Driver,
  ES8Driver,
} from "../../../lib/service/storage/builtInDrivers";
import type { StorageEngineElasticsearch } from "../../../lib/types/config/storageEngine/StorageEngineElasticsearchConfiguration";
import type {
  StorageCapability,
  StorageDriver,
} from "../../../lib/types/storage/StorageDriver";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/** A driver package written on disk, as `npm install` would leave it */
type DriverPackage = {
  name?: string;
  version?: string;
  /** `manifest.json`, as an object or as raw text; `null` leaves it out */
  manifest?: unknown;
  /** The entry point's source */
  source?: string;
  /** Extra `package.json` fields */
  pkg?: Record<string, unknown>;
  /** Where the entry point lives, relative to the package root */
  main?: string;
};

const DRIVER_SOURCE = `
class MemoryDriver {
  constructor(config, scope) { this.config = config; this.scope = scope; }
  static createNativeClient(clientConfig) { return { clientConfig }; }
  stats() {}
}
module.exports = MemoryDriver;
`;

describe("#core/storage/storageDriverLoader", () => {
  let appRoot: string;
  let config: StorageEngineElasticsearch;

  /**
   * Installs a driver package under the application's `node_modules`, and
   * names it in the configuration.
   */
  const install = ({
    name = "storage-memory",
    version = "1.2.3",
    manifest = { capabilities: ["stats"], kuzzleVersion: ">=2.0.0 <3" },
    source = DRIVER_SOURCE,
    pkg = {},
    main = "index.js",
  }: DriverPackage = {}) => {
    const root = path.join(appRoot, "node_modules", name);

    mkdirSync(path.dirname(path.join(root, main)), { recursive: true });
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ main, name, version, ...pkg }),
    );
    writeFileSync(path.join(root, main), source);

    if (manifest !== null) {
      writeFileSync(
        path.join(root, "manifest.json"),
        typeof manifest === "string" ? manifest : JSON.stringify(manifest),
      );
    }

    config.driver = name;

    return root;
  };

  beforeEach(() => {
    appRoot = mkdtempSync(path.join(tmpdir(), "kuzzle-storage-driver-"));
    // The loader looks the driver up from the application, first
    vi.spyOn(process, "cwd").mockReturnValue(appRoot);

    const kuzzleConfig = structuredClone(loadConfig());

    kuzzleConfig.version = "2.61.0";
    config = kuzzleConfig.services.storageEngine;
    stubKuzzle({ config: kuzzleConfig });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreKuzzle();
    rmSync(appRoot, { force: true, recursive: true });
  });

  describe("without services.storageEngine.driver", () => {
    it.each([
      ["7" as const, ES7Driver],
      ["8" as const, ES8Driver],
    ])(
      "selects the built-in Elasticsearch %s driver",
      (majorVersion, Driver) => {
        config.majorVersion = majorVersion;

        expect(selectStorageDriver(config)).toEqual({
          Driver,
          capabilities: new Set([
            "aggregations",
            "mappingUpdates",
            "stats",
            "updateByQuery",
          ]),
          description: `the built-in Elasticsearch ${majorVersion} driver`,
          identity: null,
        });
      },
    );

    it("builds a native client of the configured major version", () => {
      config.majorVersion = "8";

      expect(
        createNativeStorageClient(config, { node: "http://es:9200" }),
      ).toBeInstanceOf(ClientES8);
    });

    it("builds an Elasticsearch 7 client when no major version is set, as it always has", () => {
      const withoutVersion = {
        ...config,
      } as Partial<StorageEngineElasticsearch>;
      delete withoutVersion.majorVersion;

      expect(
        createNativeStorageClient(
          withoutVersion as StorageEngineElasticsearch,
          { node: "http://es:9200" },
        ),
      ).toBeInstanceOf(ClientES7);
    });
  });

  describe("with services.storageEngine.driver", () => {
    it("loads the package's driver class, with its manifest's capabilities", () => {
      install();

      const selected = selectStorageDriver(config);

      expect(selected).toMatchObject({
        capabilities: new Set(["stats"]),
        description: "storage-memory@1.2.3",
        identity: "storage-memory@1.2.3",
      });
      expect(selected.Driver.name).toBe("MemoryDriver");
    });

    it("loads it once per configuration", () => {
      install();

      expect(selectStorageDriver(config)).toBe(selectStorageDriver(config));
    });

    it("accepts a class exported as `default`", () => {
      install({
        source: DRIVER_SOURCE.replace(
          "module.exports = MemoryDriver",
          "exports.default = MemoryDriver",
        ),
      });

      expect(selectStorageDriver(config).Driver.name).toBe("MemoryDriver");
    });

    it("finds the manifest at the package root, whatever its exports allow", () => {
      install({
        main: "dist/cjs/index.js",
        name: "@kuzzleio/storage-memory",
        pkg: { exports: { ".": "./dist/cjs/index.js" } },
      });
      // A nested `package.json`, as dual CJS / ESM builds ship
      writeFileSync(
        path.join(
          appRoot,
          "node_modules/@kuzzleio/storage-memory/dist/cjs/package.json",
        ),
        JSON.stringify({ type: "commonjs" }),
      );

      expect(selectStorageDriver(config).identity).toBe(
        "@kuzzleio/storage-memory@1.2.3",
      );
    });

    it("builds the native client through the driver class", () => {
      install();

      expect(createNativeStorageClient(config, { node: "memory:" })).toEqual({
        clientConfig: { node: "memory:" },
      });
    });

    it.each([
      [
        "an unknown package",
        "storage-nowhere",
        /Cannot find the storage driver "storage-nowhere": Cannot find module/,
      ],
      [
        "an empty name",
        "",
        /services\.storageEngine\.driver must be an npm package name/,
      ],
    ])("refuses %s", (_case, name, message) => {
      config.driver = name;

      expect(() => selectStorageDriver(config)).toThrow(
        expect.objectContaining({
          id: "services.storage_driver.not_found",
          message: expect.stringMatching(message),
        }),
      );
    });

    it.each([
      ["no manifest", null, /cannot read .*manifest\.json/],
      ["a manifest that is not JSON", "{ nope", /cannot read .*manifest\.json/],
      [
        "no kuzzleVersion",
        { capabilities: [] },
        /"kuzzleVersion" must be a semver range/,
      ],
      [
        "a kuzzleVersion that is no range",
        { capabilities: [], kuzzleVersion: "two" },
        /"kuzzleVersion" must be a semver range/,
      ],
      [
        "no capabilities",
        { kuzzleVersion: ">=2" },
        /"capabilities" must be an array/,
      ],
      [
        "an unknown capability",
        { capabilities: ["joins"], kuzzleVersion: ">=2" },
        /unknown capability "joins" \(known: aggregations, mappingUpdates, stats, updateByQuery\)/,
      ],
    ])("refuses %s", (_case, manifest, message) => {
      install({ manifest });

      expect(() => selectStorageDriver(config)).toThrow(
        expect.objectContaining({
          id: "services.storage_driver.invalid_manifest",
          message: expect.stringMatching(message),
        }),
      );
    });

    it("refuses a driver for other Kuzzle versions, before running its code", () => {
      install({
        manifest: { capabilities: [], kuzzleVersion: ">=3" },
        source: "globalThis.storageDriverLoaded = true;",
      });

      expect(() => selectStorageDriver(config)).toThrow(
        expect.objectContaining({
          id: "services.storage_driver.version_mismatch",
          message:
            'The storage driver "storage-memory" requires Kuzzle >=3, this is Kuzzle 2.61.0.',
        }),
      );
      expect(globalThis).not.toHaveProperty("storageDriverLoaded");
    });

    it.each([
      [
        "exports no class",
        "module.exports = { MemoryDriver: 42 };",
        /must export a storage driver class/,
      ],
      [
        "has no createNativeClient",
        "module.exports = class {};",
        /static createNativeClient\(\)/,
      ],
      ["fails to load", "throw new Error('boom');", /boom/],
    ])("refuses a package that %s", (_case, source, message) => {
      install({ source });

      expect(() => selectStorageDriver(config)).toThrow(
        expect.objectContaining({
          id: "services.storage_driver.invalid_driver",
          message: expect.stringMatching(message),
        }),
      );
    });
  });

  describe("#assertDeclaredCapabilities", () => {
    const selected = (
      capabilities: StorageCapability[],
    ): SelectedStorageDriver => ({
      Driver: ES7Driver,
      capabilities: new Set(capabilities),
      description: "storage-memory@1.2.3",
      identity: "storage-memory@1.2.3",
    });

    const driverWith = (methods: Record<string, unknown>) =>
      methods as unknown as StorageDriver;

    it("accepts a driver with every method of its capabilities", () => {
      expect(() =>
        assertDeclaredCapabilities(
          // Instance properties count as much as prototype methods
          driverWith({ bulkUpdateByQuery: () => {}, updateByQuery: () => {} }),
          selected(["updateByQuery", "aggregations"]),
        ),
      ).not.toThrow();
    });

    it("refuses a driver lacking a method of a declared capability", () => {
      expect(() =>
        assertDeclaredCapabilities(
          driverWith({ updateMapping: () => {} }),
          selected(["mappingUpdates"]),
        ),
      ).toThrow(
        expect.objectContaining({
          id: "services.storage_driver.invalid_driver",
          message:
            'Invalid storage driver "storage-memory@1.2.3": it declares the "mappingUpdates" capability but has no "updateCollection" method.',
        }),
      );
    });
  });
});
