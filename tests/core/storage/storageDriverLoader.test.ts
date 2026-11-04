import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadConfig } from "../../../lib/config";
import {
  assertDriverContract,
  CORE_METHODS,
  createNativeStorageClient,
  getStorageEngineInfo,
  selectStorageDriver,
  type SelectedStorageDriver,
} from "../../../lib/core/storage/storageDriverLoader";
import { builtInStorageDriver } from "../../../lib/service/storage/builtInDrivers";
import type { JSONObject } from "../../../lib/types/JSONObject";
import type { StorageEngineElasticsearch } from "../../../lib/types/config/storageEngine/StorageEngineElasticsearchConfiguration";
import type {
  StorageCapability,
  StorageDriver,
} from "../../../lib/types/storage/StorageDriver";
import { builtInDriverClient } from "../../helpers/builtInDriverClient";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/** A driver package written on disk, as `npm install` would leave it */
type DriverPackage = {
  name?: string;
  /** Where it is installed under `node_modules`, `name` by default */
  dir?: string;
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

const nodeRequire = createRequire(__filename);

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
    dir = name,
    version = "1.2.3",
    manifest = { capabilities: ["stats"], kuzzleVersion: ">=2.0.0 <3" },
    source = DRIVER_SOURCE,
    pkg = {},
    main = "index.js",
  }: DriverPackage = {}) => {
    const root = path.join(appRoot, "node_modules", dir);

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

    config.driver = dir;

    return root;
  };

  beforeEach(() => {
    // What Node resolves to, on macOS too (/var is a symbolic link there)
    appRoot = realpathSync(
      mkdtempSync(path.join(tmpdir(), "kuzzle-storage-driver-")),
    );
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
    it.each([["7" as const], ["8" as const]])(
      "selects the built-in Elasticsearch %s driver",
      (majorVersion) => {
        config.majorVersion = majorVersion;

        expect(selectStorageDriver(config)).toEqual({
          Driver: builtInStorageDriver(majorVersion),
          builtIn: `kuzzle-storage-es-${majorVersion}`,
          capabilities: new Set([
            "aggregations",
            "mappingUpdates",
            "stats",
            "updateByQuery",
          ]),
          description: `the built-in Elasticsearch ${majorVersion} driver`,
          identity: null,
          location: null,
          packageName: `kuzzle-storage-es-${majorVersion}`,
        });
      },
    );

    it("builds a native client of the configured major version", () => {
      config.majorVersion = "8";

      expect(
        createNativeStorageClient(config, { node: "http://es:9200" }),
      ).toBeInstanceOf(builtInDriverClient("8"));
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
      ).toBeInstanceOf(builtInDriverClient("7"));
    });
  });

  describe("with services.storageEngine.driver", () => {
    it("loads the package's driver class, with its manifest's capabilities", () => {
      install();

      const selected = selectStorageDriver(config);

      expect(selected).toMatchObject({
        builtIn: null,
        capabilities: new Set(["stats"]),
        description: "storage-memory@1.2.3",
        identity: "storage-memory@1.2.3",
        location: path.join(appRoot, "node_modules/storage-memory"),
        packageName: "storage-memory",
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

    it("accepts an npm alias, identified by the aliased package", () => {
      install({ dir: "my-storage" });

      expect(selectStorageDriver(config)).toMatchObject({
        description: "my-storage (storage-memory@1.2.3)",
        identity: "storage-memory@1.2.3",
        location: path.join(appRoot, "node_modules/my-storage"),
        packageName: "storage-memory",
      });
    });

    it("refuses an unknown package, with how to install it and without Node's require stack", () => {
      config.driver = "storage-nowhere";

      expect(() => selectStorageDriver(config)).toThrow(
        expect.objectContaining({
          id: "services.storage_driver.not_found",
          message:
            "Cannot find the storage driver \"storage-nowhere\": Cannot find module 'storage-nowhere'. Install it next to kuzzle: npm install storage-nowhere.",
        }),
      );
    });

    it("refuses an installed package without an entry point, naming its version", () => {
      // A name-reservation placeholder: a bare package.json
      const root = path.join(appRoot, "node_modules/storage-memory");

      mkdirSync(root, { recursive: true });
      writeFileSync(
        path.join(root, "package.json"),
        JSON.stringify({ name: "storage-memory", version: "0.0.0" }),
      );
      config.driver = "storage-memory";

      expect(() => selectStorageDriver(config)).toThrow(
        expect.objectContaining({
          id: "services.storage_driver.not_found",
          message:
            'Cannot find the storage driver "storage-memory": installed storage-memory@0.0.0 has no entry point.',
        }),
      );
    });

    it.each([
      [
        "an empty name",
        "",
        /services\.storageEngine\.driver must be an npm package name\.$/,
      ],
      [
        "a relative path",
        "./storage-memory",
        /must be an npm package name, not a path: install the driver \(npm install \.\/storage-memory\), then set its package name/,
      ],
      ["an absolute path", "/opt/storage-memory", /not a path/],
      [
        "a version",
        "storage-memory@1.2.3",
        /must be an npm package name, without a version or a subpath/,
      ],
      ["a subpath", "storage-memory/lib", /without a version or a subpath/],
    ])("refuses %s", (_case, name, message) => {
      install();
      config.driver = name;

      expect(() => selectStorageDriver(config)).toThrow(
        expect.objectContaining({
          id: "services.storage_driver.not_found",
          message: expect.stringMatching(message),
        }),
      );
    });

    it.each([
      // The path once, where Node's error would repeat it
      ["no manifest", null, /: [^ ]*manifest\.json does not exist\.$/],
      [
        "a manifest that is not JSON",
        "{ nope",
        /: [^ ]*manifest\.json is not valid JSON: /,
      ],
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

  describe("the kuzzle a driver package requires", () => {
    // What Node's cache holds once Kuzzle runs from its sources
    const entry = path.resolve(__dirname, "../../../index.ts");
    const saved = nodeRequire.cache[entry];
    const running = { exports: { running: true } } as unknown as NodeJS.Module;

    /** A driver handing out the `kuzzle` it got */
    const KUZZLE_USER_SOURCE = `
const kuzzle = require("kuzzle");
module.exports = class KuzzleUser {
  static createNativeClient() { return { kuzzle }; }
};
`;

    /**
     * A stale copy of kuzzle next to the driver, as npm installs one for its
     * peer dependency when Kuzzle is itself the application
     */
    const installKuzzleCopy = () => {
      const root = path.join(appRoot, "node_modules/kuzzle");

      mkdirSync(root, { recursive: true });
      writeFileSync(
        path.join(root, "package.json"),
        JSON.stringify({ main: "index.js", name: "kuzzle", version: "2.0.0" }),
      );
      writeFileSync(
        path.join(root, "index.js"),
        "globalThis.staleKuzzleLoaded = true; module.exports = { stale: true };",
      );

      return path.join(root, "index.js");
    };

    beforeEach(() => {
      nodeRequire.cache[entry] = running;
    });

    afterEach(() => {
      if (saved) {
        nodeRequire.cache[entry] = saved;
      } else {
        delete nodeRequire.cache[entry];
      }

      for (const file of Object.keys(nodeRequire.cache)) {
        if (file.startsWith(appRoot)) {
          delete nodeRequire.cache[file];
        }
      }

      delete (globalThis as { staleKuzzleLoaded?: boolean }).staleKuzzleLoaded;
    });

    it("is the running Kuzzle, not the copy installed next to the driver", () => {
      installKuzzleCopy();
      install({ source: KUZZLE_USER_SOURCE });

      expect(createNativeStorageClient(config, {})).toEqual({
        kuzzle: running.exports,
      });
      expect(globalThis).not.toHaveProperty("staleKuzzleLoaded");
    });

    it("is left alone when already loaded: the running Kuzzle, in an application", () => {
      const loaded = { exports: { loaded: true } } as unknown as NodeJS.Module;

      nodeRequire.cache[installKuzzleCopy()] = loaded;
      install({ source: KUZZLE_USER_SOURCE });

      expect(createNativeStorageClient(config, {})).toEqual({
        kuzzle: loaded.exports,
      });
    });

    it("is nothing to provide when no kuzzle is installed next to the driver", () => {
      install();

      expect(selectStorageDriver(config).Driver.name).toBe("MemoryDriver");
    });
  });

  describe("#getStorageEngineInfo", () => {
    const answerInfo = (info: JSONObject) => {
      const ask = vi.fn(async () => info);

      global.kuzzle.ask = ask as unknown as typeof global.kuzzle.ask;

      return ask;
    };

    it("tells the built-in driver's package and the engine it runs on", async () => {
      config.majorVersion = "8";
      const ask = answerInfo({ type: "elasticsearch", version: "8.17.1" });

      await expect(getStorageEngineInfo()).resolves.toEqual({
        driver: "kuzzle-storage-es-8",
        engine: "elasticsearch",
        version: "8.17.1",
      });
      expect(ask).toHaveBeenCalledWith("core:storage:public:info:get");
    });

    it("tells an external driver's package, while majorVersion keeps its default", async () => {
      install({ dir: "my-storage" });
      answerInfo({ status: "green", type: "opensearch", version: "3.2.0" });

      await expect(getStorageEngineInfo()).resolves.toEqual({
        driver: "storage-memory",
        engine: "opensearch",
        version: "3.2.0",
      });
      expect(config.majorVersion).toBe("7");
    });
  });

  describe("#assertDriverContract", () => {
    const selected = (
      capabilities: StorageCapability[],
    ): SelectedStorageDriver => ({
      Driver: builtInStorageDriver("7"),
      builtIn: null,
      capabilities: new Set(capabilities),
      description: "storage-memory@1.2.3",
      identity: "storage-memory@1.2.3",
      location: null,
      packageName: "storage-memory",
    });

    /** A driver with every core method, and these */
    const driverWith = (methods: Record<string, unknown>) =>
      ({
        ...Object.fromEntries(CORE_METHODS.map((method) => [method, () => {}])),
        ...methods,
      }) as unknown as StorageDriver;

    it("refuses a driver lacking methods of the core contract", () => {
      expect(() =>
        assertDriverContract(
          driverWith({ mExecute: undefined, scroll: 42 }),
          selected([]),
        ),
      ).toThrow(
        expect.objectContaining({
          id: "services.storage_driver.invalid_driver",
          message:
            'Invalid storage driver "storage-memory@1.2.3": it lacks methods of the core contract: mExecute, scroll.',
        }),
      );
    });

    it("accepts a driver with every method of its capabilities", () => {
      expect(() =>
        assertDriverContract(
          // Instance properties count as much as prototype methods
          driverWith({ bulkUpdateByQuery: () => {}, updateByQuery: () => {} }),
          selected(["updateByQuery", "aggregations"]),
        ),
      ).not.toThrow();
    });

    it("refuses a driver lacking a method of a declared capability", () => {
      expect(() =>
        assertDriverContract(
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
