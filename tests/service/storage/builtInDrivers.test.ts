import * as fs from "node:fs";
import Module, { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { builtInStorageDriver } from "../../../lib/service/storage/builtInDrivers";
import { provideRunningKuzzle } from "../../../lib/service/storage/driverPackage";
import type { StorageEngineElasticsearch } from "../../../lib/types/config/storageEngine/StorageEngineElasticsearchConfiguration";

const root = path.resolve(__dirname, "../../..");
const nodeRequire = createRequire(path.join(root, "package.json"));

describe("built-in storage drivers", () => {
  describe.each([
    ["7" as const, "kuzzle-storage-es-7"],
    ["8" as const, "kuzzle-storage-es-8"],
  ])("Elasticsearch %s", (majorVersion, packageName) => {
    it(`is the driver of ${packageName}`, () => {
      const Driver = builtInStorageDriver(majorVersion);

      expect(Driver).toBe(nodeRequire(packageName).default);
      expect(Driver.name).toBe(`ES${majorVersion}Driver`);
    });

    it("builds a new native client from a client configuration", () => {
      const Driver = builtInStorageDriver(majorVersion);
      const client = Driver.createNativeClient({ node: "http://es:9200" });

      expect(client.connectionPool.connections[0].url.toString()).toBe(
        "http://es:9200/",
      );
      expect(Driver.createNativeClient({ node: "http://es:9200" })).not.toBe(
        client,
      );
    });
  });

  it("refuses to start when the driver package is not installed", () => {
    // `Module._resolveFilename` is what `require.resolve` relies on
    const loader = Module as unknown as {
      _resolveFilename: (request: string, ...rest: unknown[]) => string;
    };
    const resolve = loader._resolveFilename;

    vi.spyOn(loader, "_resolveFilename").mockImplementation(
      function resolveFilename(this: unknown, request, ...rest) {
        if (request === "kuzzle-storage-es-8") {
          throw new Error(
            "Cannot find module 'kuzzle-storage-es-8'\nRequire stack:\n- /var/app/lib/service/storage/builtInDrivers.js",
          );
        }

        return resolve.call(this, request, ...rest);
      },
    );

    try {
      expect(() => builtInStorageDriver("8")).toThrow(
        expect.objectContaining({
          id: "services.storage_driver.not_found",
          message:
            "Cannot find the storage driver \"kuzzle-storage-es-8\": Cannot find module 'kuzzle-storage-es-8'. Install it next to kuzzle: npm install kuzzle-storage-es-8.",
        }),
      );
    } finally {
      vi.restoreAllMocks();
    }
  });

  it.each(["6", "9", "toString"])(
    "refuses an unknown major version (%s), pointing to the drivers",
    (majorVersion) => {
      expect(() =>
        builtInStorageDriver(
          majorVersion as StorageEngineElasticsearch["majorVersion"],
        ),
      ).toThrow(
        expect.objectContaining({
          id: "services.storage_driver.unsupported_major_version",
          message: `Unsupported services.storageEngine.majorVersion "${majorVersion}" (supported: 7, 8): for Elasticsearch 9 or OpenSearch, set services.storageEngine.driver instead (e.g. "kuzzle-storage-es-9").`,
        }),
      );
    },
  );

  describe("the kuzzle a driver package requires", () => {
    const entry = path.join(root, "index.ts");
    const savedEntry = nodeRequire.cache[entry];
    const dirs: string[] = [];

    /**
     * A driver package outside the repository, with its own copy of `kuzzle`
     * (what npm installs for a required peer dependency when Kuzzle is the
     * root package), or none.
     */
    function driverPackage(withCopy: boolean) {
      const dir = fs.realpathSync(
        fs.mkdtempSync(path.join(os.tmpdir(), "kuzzle-driver-")),
      );
      const driver = path.join(dir, "dist", "index.js");
      const copy = path.join(dir, "node_modules", "kuzzle", "index.js");

      dirs.push(dir);
      fs.mkdirSync(path.dirname(driver));
      fs.writeFileSync(path.join(dir, "package.json"), "{}");
      fs.writeFileSync(driver, 'module.exports = require("kuzzle");');

      if (withCopy) {
        fs.mkdirSync(path.dirname(copy), { recursive: true });
        fs.writeFileSync(copy, "module.exports = { copy: true };");
      }

      return { copy, dir, driver };
    }

    afterEach(() => {
      if (savedEntry) {
        nodeRequire.cache[entry] = savedEntry;
      } else {
        delete nodeRequire.cache[entry];
      }

      for (const dir of dirs.splice(0)) {
        for (const file of Object.keys(nodeRequire.cache)) {
          if (file.startsWith(dir)) {
            delete nodeRequire.cache[file];
          }
        }
        fs.rmSync(dir, { force: true, recursive: true });
      }
    });

    it("is the running Kuzzle, when npm installed another copy", () => {
      const { copy, driver } = driverPackage(true);
      // What Node's cache holds once Kuzzle runs from its sources
      const running = { exports: {} } as NodeJS.Module;

      nodeRequire.cache[entry] = running;

      provideRunningKuzzle(driver);

      expect(nodeRequire.cache[copy]).toBe(running);
      expect(nodeRequire(driver)).toBe(running.exports);
    });

    it("is the running Kuzzle, when npm installed no copy", () => {
      // No `kuzzle` resolves from it (outside the repo)
      const { dir, driver } = driverPackage(false);

      const running = {
        exports: { running: true },
        filename: entry,
        loaded: true,
      } as unknown as NodeJS.Module;
      nodeRequire.cache[entry] = running;

      expect(() => nodeRequire.resolve("kuzzle", { paths: [dir] })).toThrow(
        expect.objectContaining({ code: "MODULE_NOT_FOUND" }),
      );

      provideRunningKuzzle(driver);

      expect(nodeRequire(driver)).toBe(running.exports);
      // Only from that package
      expect(() => nodeRequire.resolve("kuzzle", { paths: [dir] })).toThrow(
        expect.objectContaining({ code: "MODULE_NOT_FOUND" }),
      );
    });

    it("is left alone when already loaded", () => {
      const { copy, driver } = driverPackage(true);
      const loaded = { exports: {} } as NodeJS.Module;

      nodeRequire.cache[entry] = { exports: {} } as NodeJS.Module;
      nodeRequire.cache[copy] = loaded;

      provideRunningKuzzle(driver);

      expect(nodeRequire.cache[copy]).toBe(loaded);
    });
  });
});
