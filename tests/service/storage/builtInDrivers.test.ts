import { createRequire } from "node:module";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { builtInStorageDriver } from "../../../lib/service/storage/builtInDrivers";
import type { StorageEngineElasticsearch } from "../../../lib/types/config/storageEngine/StorageEngineElasticsearchConfiguration";

const root = path.resolve(__dirname, "../../..");
const nodeRequire = createRequire(path.join(root, "package.json"));

/** The `kuzzle` a driver package gets from `require("kuzzle")` */
function peerOf(packageName: string): string {
  return nodeRequire.resolve("kuzzle", {
    paths: [path.dirname(nodeRequire.resolve(packageName))],
  });
}

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

  it("refuses an unknown major version", () => {
    expect(() =>
      builtInStorageDriver("6" as StorageEngineElasticsearch["majorVersion"]),
    ).toThrow("Invalid Elasticsearch version.");
  });

  describe("the kuzzle a driver package requires", () => {
    const entry = path.join(root, "index.ts");
    const peer = peerOf("kuzzle-storage-es-7");
    const saved = {
      entry: nodeRequire.cache[entry],
      peer: nodeRequire.cache[peer],
    };

    afterEach(() => {
      for (const [file, module] of [
        [entry, saved.entry],
        [peer, saved.peer],
      ] as const) {
        if (module) {
          nodeRequire.cache[file] = module;
        } else {
          delete nodeRequire.cache[file];
        }
      }
    });

    it("is the running Kuzzle, when npm installed another copy", () => {
      // What Node's cache holds once Kuzzle runs from its sources
      const running = { exports: {} } as NodeJS.Module;

      nodeRequire.cache[entry] = running;
      delete nodeRequire.cache[peer];

      builtInStorageDriver("7");

      expect(peer).not.toBe(entry);
      expect(nodeRequire.cache[peer]).toBe(running);
    });

    it("is left alone when already loaded", () => {
      const loaded = { exports: {} } as NodeJS.Module;

      nodeRequire.cache[entry] = { exports: {} } as NodeJS.Module;
      nodeRequire.cache[peer] = loaded;

      builtInStorageDriver("7");

      expect(nodeRequire.cache[peer]).toBe(loaded);
    });
  });
});
