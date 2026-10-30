/* The conformance kit's own mechanics: what it registers, its hooks, and the
 * stand-in for Kuzzle it runs a driver with. Its cases run against a real
 * Elasticsearch in tests/conformance/ (`npm run test:conformance`). */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  field,
  hasField,
  rejectsWith,
} from "../../../../lib/core/storage/conformance/conformanceContext";
import { installConformanceEnvironment } from "../../../../lib/core/storage/conformance/conformanceEnvironment";
import {
  describeStorageDriverConformance,
  type ConformanceTestApi,
} from "../../../../lib/core/storage/conformance/storageDriverConformance";
import { storeScopeEnum } from "../../../../lib/core/storage/storeScopeEnum";
import { NotFoundError } from "../../../../lib/kerror/errors";
import { withLock } from "../../../../lib/util/distributedLock";
import type { StorageEngineElasticsearch } from "../../../../lib/types/config/storageEngine/StorageEngineElasticsearchConfiguration";
import type {
  StorageCapability,
  StorageDriverClass,
} from "../../../../lib/types/storage/StorageDriver";
import * as kuzzleIndex from "../../../../index";

/** Records what the kit registers, without running it */
function recorder() {
  const suites: string[] = [];
  const tests: string[] = [];
  const beforeAll: (() => Promise<void>)[] = [];
  const afterAll: (() => Promise<void>)[] = [];
  const path: string[] = [];

  const api: ConformanceTestApi = {
    afterAll: (body) => afterAll.push(body),
    beforeAll: (body) => beforeAll.push(body),
    describe: (name, body) => {
      path.push(name);
      suites.push(path.join(" > "));
      body();
      path.pop();
    },
    it: (name) => tests.push([...path, name].join(" > ")),
  };

  return { afterAll, api, beforeAll, suites, tests };
}

/** A driver recording its calls, and the scope and config it was built with */
function fakeDriver(failInit: boolean) {
  const instances: {
    config: StorageEngineElasticsearch;
    scope: storeScopeEnum;
    calls: string[];
  }[] = [];

  class FakeDriver {
    static createNativeClient = vi.fn();
    calls: string[] = [];

    constructor(config: StorageEngineElasticsearch, scope: storeScopeEnum) {
      instances.push({ calls: this.calls, config, scope });
    }

    async init() {
      if (failInit) {
        throw new Error("down");
      }

      this.calls.push("init");
    }

    async createIndex(index: string) {
      this.calls.push(`createIndex ${index}`);
    }

    async deleteIndexes(indexes: string[]) {
      this.calls.push(`deleteIndexes ${indexes.join(",")}`);
      return indexes;
    }
  }

  // Only the members the hooks call: the cases are not run here
  const Driver: unknown = FakeDriver;

  return {
    Driver: Driver as StorageDriverClass<unknown, StorageEngineElasticsearch>,
    instances,
  };
}

function register(capabilities: StorageCapability[], failInit = false) {
  const recorded = recorder();
  const fake = fakeDriver(failInit);

  describeStorageDriverConformance({
    Driver: fake.Driver,
    capabilities,
    config: { client: { node: "http://es:9200" } },
    indexPrefix: "kit",
    test: recorded.api,
  });

  return { ...fake, ...recorded };
}

describe("#core/storage/conformance", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is exported by kuzzle", () => {
    expect(kuzzleIndex.describeStorageDriverConformance).toBe(
      describeStorageDriverConformance,
    );
  });

  describe("describeStorageDriverConformance", () => {
    it("registers the core cases, and those of the declared capabilities only", () => {
      const { suites, tests } = register(["stats"]);

      expect(suites).toContain("Storage driver conformance > core: documents");
      expect(suites).toContain(
        "Storage driver conformance > capability: stats",
      );
      expect(suites.filter((name) => name.includes("capability:"))).toEqual([
        "Storage driver conformance > capability: stats",
      ]);
      expect(tests.length).toBeGreaterThan(20);
    });

    it("registers every capability group a driver declares", () => {
      const { suites } = register([
        "aggregations",
        "mappingUpdates",
        "stats",
        "updateByQuery",
      ]);

      expect(suites.filter((name) => name.includes("capability:"))).toEqual([
        "Storage driver conformance > capability: aggregations",
        "Storage driver conformance > capability: mappingUpdates",
        "Storage driver conformance > capability: stats",
        "Storage driver conformance > capability: updateByQuery",
      ]);
    });

    it("builds one driver per scope over Kuzzle's defaults, creates its index, then deletes it", async () => {
      const { afterAll, beforeAll, instances } = register([]);
      const kuzzleBefore = Object.getOwnPropertyDescriptor(
        globalThis,
        "kuzzle",
      );

      // The kit's own hooks come first: the others belong to its cases
      await beforeAll[0]?.();

      expect(instances.map(({ scope }) => scope)).toEqual([
        storeScopeEnum.PUBLIC,
        storeScopeEnum.PRIVATE,
      ]);
      expect(instances[0]?.config.client).toEqual({ node: "http://es:9200" });
      expect(instances[0]?.config.commonMapping).toBeDefined();
      expect(instances[0]?.calls).toEqual([
        "init",
        expect.stringMatching(/^createIndex kit-[0-9a-f]{8}$/),
      ]);
      expect(instances[1]?.calls).toEqual(["init"]);

      await afterAll[0]?.();

      const index = instances[0]?.calls[1]?.split(" ")[1];
      expect(instances[0]?.calls[2]).toBe(`deleteIndexes ${index}`);
      expect(Object.getOwnPropertyDescriptor(globalThis, "kuzzle")).toEqual(
        kuzzleBefore,
      );
    });

    it("deletes nothing when the driver failed to initialize", async () => {
      const { afterAll, beforeAll, instances } = register([], true);

      await expect(beforeAll[0]?.()).rejects.toThrow("down");
      await afterAll[0]?.();

      expect(instances[0]?.calls).toEqual([]);
    });
  });

  describe("the stand-in for Kuzzle", () => {
    const withoutKuzzle = () => {
      const saved = Object.getOwnPropertyDescriptor(globalThis, "kuzzle");
      Reflect.deleteProperty(globalThis, "kuzzle");

      return () => {
        if (saved) {
          Object.defineProperty(globalThis, "kuzzle", saved);
        }
      };
    };

    it("is left out when a Kuzzle instance is already there", () => {
      const restore = withoutKuzzle();
      const running = { running: true };

      Object.defineProperty(globalThis, "kuzzle", {
        configurable: true,
        value: running,
        writable: true,
      });

      try {
        installConformanceEnvironment()();

        expect(globalThis.kuzzle).toBe(running);
      } finally {
        Reflect.deleteProperty(globalThis, "kuzzle");
        restore();
      }
    });

    it("answers what the built-in drivers use of Kuzzle, then goes away", async () => {
      const restore = withoutKuzzle();

      try {
        const remove = installConformanceEnvironment();
        const { kuzzle } = globalThis;

        expect(kuzzle.config.limits.documentsWriteCount).toBeGreaterThan(0);
        expect(kuzzle.log.child("driver").info("silent")).toBeUndefined();
        expect(kuzzle.hash("a")).toBe(kuzzle.hash("a"));
        expect(kuzzle.hash({ a: 1 })).not.toBe(kuzzle.hash({ a: 2 }));
        expect(kuzzle.emit("services:storage:error", {})).toBeUndefined();

        await kuzzle.ask("core:cache:internal:store", "key", "value", {});
        expect(await kuzzle.ask("core:cache:internal:get", "key")).toBe(
          "value",
        );
        await kuzzle.ask("core:cache:internal:del", "key");
        expect(await kuzzle.ask("core:cache:internal:get", "key")).toBeNull();

        await expect(
          kuzzle.ask("core:realtime:publish", {} as never),
        ).rejects.toThrow('does not answer "core:realtime:publish"');

        remove();
        expect(Object.hasOwn(globalThis, "kuzzle")).toBe(false);
      } finally {
        restore();
      }
    });

    it("holds the locks a driver takes, in memory", async () => {
      const restore = withoutKuzzle();
      const remove = installConformanceEnvironment();

      try {
        const client = (await globalThis.kuzzle.ask(
          "core:cache:internal:client:get",
        )) as unknown as {
          set(key: string, value: string): string | null;
          evalsha(...args: unknown[]): number;
        };

        expect(client.set("lock", "me")).toBe("OK");
        expect(client.set("lock", "other")).toBeNull();
        // Extending (with a TTL) keeps the lock, releasing deletes it
        expect(client.evalsha("sha", 1, "lock", "other", "100")).toBe(0);
        expect(client.evalsha("sha", 1, "lock", "me", "100")).toBe(1);
        expect(client.evalsha("sha", 1, "lock", "me")).toBe(1);
        expect(client.set("lock", "other")).toBe("OK");

        await expect(withLock("resource", async () => "done")).resolves.toBe(
          "done",
        );
      } finally {
        remove();
        restore();
      }
    });
  });

  describe("assertions", () => {
    it("checks a Kuzzle error by its id or its status", async () => {
      const error = new NotFoundError("missing", "services.storage.not_found");

      await rejectsWith(Promise.reject(error), "services.storage.not_found");
      await rejectsWith(Promise.reject(error), 404);
      await expect(
        rejectsWith(Promise.reject(error), "services.storage.other"),
      ).rejects.toThrow(
        'expected the Kuzzle error id "services.storage.other"',
      );
    });

    it("reads fields by their path", () => {
      expect(field({ a: { b: 1 } }, "a.b")).toBe(1);
      expect(hasField({ a: { b: 1 } }, "a.c")).toBe(false);
    });
  });
});
