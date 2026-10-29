import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { storeScopeEnum } from "../../../lib/core/storage/storeScopeEnum";

const CLIENT_METHODS = [
  "addCollection",
  "bulkUpdateByQuery",
  "count",
  "create",
  "createCollection",
  "createIndex",
  "createOrReplace",
  "delete",
  "deleteByQuery",
  "deleteCollection",
  "deleteFields",
  "deleteIndex",
  "deleteIndexes",
  "exists",
  "generateMissingAliases",
  "get",
  "getMapping",
  "getSchema",
  "getSettings",
  "import",
  "info",
  "mCreate",
  "mCreateOrReplace",
  "mDelete",
  "mExecute",
  "mExists",
  "mGet",
  "mReplace",
  "mUpdate",
  "mUpsert",
  "refreshCollection",
  "replace",
  "scroll",
  "search",
  "stats",
  "translateKoncordeFilters",
  "truncateCollection",
  "update",
  "updateByQuery",
  "updateCollection",
  "updateMapping",
  "upsert",
  "waitForCollectionShards",
] as const;

const CACHE_METHODS = [
  "addCollection",
  "addIndex",
  "assertCollectionExists",
  "assertCollectionWritable",
  "assertIndexExists",
  "assertIndexWritable",
  "getLock",
  "hasCollection",
  "hasIndex",
  "listCollections",
  "listIndexes",
  "removeCollection",
  "removeIndex",
  "removeLock",
  "replaceIndexes",
  "replaceLocks",
  "setLock",
  "snapshotIndexes",
  "snapshotLocks",
] as const;

type Recorder = Record<string, ReturnType<typeof vi.fn>>;

const { serviceInstances, cacheInstances, StorageServiceMock, IndexCacheMock } =
  vi.hoisted(() => {
    const clientMethods = [
      "addCollection",
      "bulkUpdateByQuery",
      "count",
      "create",
      "createCollection",
      "createIndex",
      "createOrReplace",
      "delete",
      "deleteByQuery",
      "deleteCollection",
      "deleteFields",
      "deleteIndex",
      "deleteIndexes",
      "exists",
      "generateMissingAliases",
      "get",
      "getMapping",
      "getSchema",
      "getSettings",
      "import",
      "info",
      "mCreate",
      "mCreateOrReplace",
      "mDelete",
      "mExecute",
      "mExists",
      "mGet",
      "mReplace",
      "mUpdate",
      "mUpsert",
      "refreshCollection",
      "replace",
      "scroll",
      "search",
      "stats",
      "translateKoncordeFilters",
      "truncateCollection",
      "update",
      "updateByQuery",
      "updateCollection",
      "updateMapping",
      "upsert",
      "waitForCollectionShards",
    ];
    const cacheMethods = [
      "addCollection",
      "addIndex",
      "assertCollectionExists",
      "assertCollectionWritable",
      "assertIndexExists",
      "assertIndexWritable",
      "getLock",
      "hasCollection",
      "hasIndex",
      "listCollections",
      "listIndexes",
      "removeCollection",
      "removeIndex",
      "removeLock",
      "replaceIndexes",
      "replaceLocks",
      "setLock",
      "snapshotIndexes",
      "snapshotLocks",
    ];
    const createdServices: unknown[] = [];
    const createdCache: unknown[] = [];

    return {
      serviceInstances: createdServices,
      cacheInstances: createdCache,
      StorageServiceMock: class {
        public driver: Record<string, ReturnType<typeof vi.fn>> = {};
        public init = vi.fn(async () => undefined);

        constructor(
          public Driver: unknown,
          public config: unknown,
          public scope: unknown,
        ) {
          for (const m of clientMethods) {
            this.driver[m] = vi.fn(async () => undefined);
          }
          // The two driver calls whose RESULT drives control flow.
          this.driver.getSchema = vi.fn(async () => ({}));
          this.driver.deleteIndexes = vi.fn(async () => [] as string[]);
          this.driver.import = vi.fn(async () => ({ errors: [] }));
          createdServices.push(this);
        }
      },
      IndexCacheMock: class {
        constructor() {
          for (const m of cacheMethods) {
            (this as unknown as Record<string, unknown>)[m] = vi.fn();
          }
          createdCache.push(this);
        }
      },
    };
  });

vi.mock("../../../lib/service/storage/storageService", () => ({
  StorageService: StorageServiceMock,
}));
vi.mock("../../../lib/service/storage/builtInDrivers", () => ({
  builtInStorageDriver: vi.fn((majorVersion: string) => `ES${majorVersion}`),
}));
vi.mock("../../../lib/core/storage/indexCache", () => ({
  IndexCache: IndexCacheMock,
}));

/** Every lock taken through `withLock`, and whether it is still held. */
const locks = vi.hoisted(() => {
  const taken: {
    config: { retryAttempts?: number; ttl?: number } | undefined;
    held: boolean;
    resource: string;
  }[] = [];

  return { taken };
});

vi.mock("../../../lib/util/distributedLock", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../../lib/util/distributedLock")
  >()),
  withLock: vi.fn(
    async (
      resource: string,
      callback: () => Promise<unknown>,
      config?: { retryAttempts?: number; ttl?: number },
    ) => {
      const lock = { config, held: true, resource };
      locks.taken.push(lock);

      try {
        return await callback();
      } finally {
        lock.held = false;
      }
    },
  ),
}));

import ClientAdapter from "../../../lib/core/storage/clientAdapter";
import { STORAGE_CAPABILITIES } from "../../../lib/types/storage/StorageDriver";
import * as kerror from "../../../lib/kerror";
import {
  MutexLockLostError,
  withLock,
} from "../../../lib/util/distributedLock";
import { present } from "../../helpers/present";

describe("#core/storage/ClientAdapter", () => {
  let adapter: ClientAdapter;
  let handlers: Map<string, (...args: unknown[]) => unknown>;
  let emitted: Array<{ event: string; payload: unknown }>;
  let client: Recorder;
  let cache: Recorder;
  let pipes: Map<string, () => unknown>;
  /** The Redis hash behind `core:cache:internal:execute`, per key. */
  let redis: Map<string, Map<string, string>>;

  /** Invokes a registered ask handler by its event suffix. */
  const ask = (suffix: string, ...args: unknown[]) => {
    const handler = handlers.get(`core:storage:private:${suffix}`);

    present(handler, `no handler registered for "${suffix}"`);

    return handler(...args);
  };

  beforeEach(async () => {
    serviceInstances.length = 0;
    cacheInstances.length = 0;
    handlers = new Map();
    emitted = [];
    pipes = new Map();
    redis = new Map();
    locks.taken.length = 0;

    const hash = (key: string) => {
      let fields = redis.get(key);

      if (fields === undefined) {
        fields = new Map();
        redis.set(key, fields);
      }

      return fields;
    };

    // The four hash commands the collection write locks use, on a Map.
    const execute = (command: string, key: string, ...args: string[]) => {
      const [field = "", value = ""] = args;

      switch (command) {
        case "hgetall":
          return Object.fromEntries(hash(key));
        case "hget":
          return hash(key).get(field) ?? null;
        case "hset":
          hash(key).set(field, value);
          return 1;
        case "hsetnx":
          if (hash(key).has(field)) {
            return 0;
          }
          hash(key).set(field, value);
          return 1;
        case "hdel":
          return hash(key).delete(field) ? 1 : 0;
        default:
          throw new Error(`unexpected Redis command ${command}`);
      }
    };

    (globalThis as { kuzzle?: unknown }).kuzzle = {
      config: {
        services: {
          storageEngine: { generateMissingAliases: false, majorVersion: "7" },
        },
      },
      emit: vi.fn((event: string, payload: unknown) => {
        emitted.push({ event, payload });
      }),
      onAsk: vi.fn((event: string, handler: (...a: unknown[]) => unknown) => {
        handlers.set(event, handler);
      }),
      onPipe: vi.fn((event: string, handler: () => unknown) => {
        pipes.set(event, handler);
      }),
      // The collection write locks reach Redis through `ask`.
      ask: vi.fn(async (event: string, ...args: unknown[]) =>
        event === "core:cache:internal:execute"
          ? execute(...(args as [string, string, ...string[]]))
          : true,
      ),
    };

    adapter = new ClientAdapter(storeScopeEnum.PRIVATE);
    await adapter.init();

    client = adapter.driver as unknown as Recorder;
    cache = adapter.cache as unknown as Recorder;
  });

  describe("#constructor", () => {
    it("builds one storage service for the scope, plus an index cache", () => {
      expect(serviceInstances).toHaveLength(1);
      expect(cacheInstances).toHaveLength(1);
      expect(adapter.scope).toBe(storeScopeEnum.PRIVATE);
      expect(adapter.driver).toBe(
        (serviceInstances[0] as { driver: unknown }).driver,
      );
    });

    it("runs the built-in driver of the configured major version", () => {
      expect(serviceInstances[0]).toMatchObject({
        Driver: "ES7",
        scope: storeScopeEnum.PRIVATE,
      });
    });
  });

  describe("#init", () => {
    it("initialises the storage service and populates the cache before registering", () => {
      expect(adapter.service.init).toHaveBeenCalledOnce();
      expect(client.getSchema).toHaveBeenCalledOnce();
      // Every documented ask event is registered.
      expect(handlers.size).toBe(58);
    });

    it("reloads the collection write locks once the node goes live", async () => {
      const loadLocks = vi.spyOn(adapter, "loadLocks");

      await pipes.get("kuzzle:state:live")?.();

      expect(loadLocks).toHaveBeenCalledOnce();
    });

    /* kuzzle#3029: a peer created them, then stopped before this node joined.
     * kuzzle#3044: `Kuzzle.start()` asks for `cache:reload` right after the
     * cluster join, before the plugins' `init()`. */
    it.each(["cache:reload", "kuzzle:state:live"])(
      "caches the indexes and collections a peer created, on %s",
      async (trigger) => {
        (
          globalThis as {
            kuzzle: {
              config: {
                services: {
                  storageEngine: { generateMissingAliases: boolean };
                };
              };
            };
          }
        ).kuzzle.config.services.storageEngine.generateMissingAliases = true;
        client.getSchema.mockResolvedValue({ peer: ["c"] });
        const snapshot = new Map();
        cache.snapshotIndexes.mockReturnValue(snapshot);
        cache.replaceIndexes.mockClear();
        const loadLocks = vi.spyOn(adapter, "loadLocks");

        await (trigger === "cache:reload"
          ? ask("cache:reload")
          : pipes.get(trigger)?.());

        // kuzzle#3040: replaced, with what was cached before storage was read.
        expect(cache.replaceIndexes).toHaveBeenCalledExactlyOnceWith(
          { peer: ["c"] },
          snapshot,
        );
        expect(cache.snapshotIndexes.mock.invocationCallOrder[0]).toBeLessThan(
          client.getSchema.mock.invocationCallOrder.at(-1) ?? 0,
        );
        expect(loadLocks).toHaveBeenCalledOnce();
        // Aliases were generated at init: a reload writes nothing.
        expect(client.generateMissingAliases).not.toHaveBeenCalled();
      },
    );

    it("namespaces every event with the adapter's scope", () => {
      for (const event of handlers.keys()) {
        expect(event.startsWith("core:storage:private:")).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------- pass-through
  //
  // The bulk of this class: an ask handler that (optionally) asserts the
  // collection exists, then forwards to the storage client or the cache. The
  // table is the contract — one row per event.
  describe("pass-through handlers", () => {
    const IDX = "an-index";
    const COL = "a-collection";
    const OPTS = { refresh: "wait_for" };

    type Row = [
      event: string,
      args: unknown[],
      target: "client" | "cache",
      method: string,
      expected: unknown[],
      assertsCollection?: boolean,
    ];

    const rows: Row[] = [
      ["info:get", [], "client", "info", []],
      [
        "translate",
        [{ a: 1 }],
        "client",
        "translateKoncordeFilters",
        [{ a: 1 }],
      ],

      [
        "collection:settings:get",
        [IDX, COL],
        "client",
        "getSettings",
        [IDX, COL],
        true,
      ],
      [
        "collection:shards:wait",
        [IDX, COL],
        "client",
        "waitForCollectionShards",
        [IDX, COL],
      ],
      ["collection:exist", [IDX, COL], "cache", "hasCollection", [IDX, COL]],
      ["collection:list", [IDX], "cache", "listCollections", [IDX]],
      [
        "collection:refresh",
        [IDX, COL],
        "client",
        "refreshCollection",
        [IDX, COL],
        true,
      ],
      [
        "collection:truncate",
        [IDX, COL],
        "client",
        "truncateCollection",
        [IDX, COL],
        true,
      ],
      [
        "collection:update",
        [IDX, COL, { a: 1 }],
        "client",
        "updateCollection",
        [IDX, COL, { a: 1 }],
        true,
      ],

      ["index:exist", [IDX], "cache", "hasIndex", [IDX]],
      ["index:list", [], "cache", "listIndexes", []],
      ["index:stats", [], "client", "stats", []],

      [
        "document:bulk",
        [IDX, COL, [{ a: 1 }], OPTS],
        "client",
        "import",
        [IDX, COL, [{ a: 1 }], OPTS],
        true,
      ],
      [
        "document:count",
        [IDX, COL, { q: 1 }],
        "client",
        "count",
        [IDX, COL, { q: 1 }],
        true,
      ],
      [
        "document:create",
        [IDX, COL, { c: 1 }, OPTS],
        "client",
        "create",
        [IDX, COL, { c: 1 }, OPTS],
        true,
      ],
      [
        "document:createOrReplace",
        [IDX, COL, "id", { c: 1 }, OPTS],
        "client",
        "createOrReplace",
        [IDX, COL, "id", { c: 1 }, OPTS],
        true,
      ],
      [
        "document:delete",
        [IDX, COL, "id", OPTS],
        "client",
        "delete",
        [IDX, COL, "id", OPTS],
        true,
      ],
      [
        "document:deleteByQuery",
        [IDX, COL, { q: 1 }, OPTS],
        "client",
        "deleteByQuery",
        [IDX, COL, { q: 1 }, OPTS],
        true,
      ],
      [
        "document:deleteFields",
        [IDX, COL, "id", ["f"], OPTS],
        "client",
        "deleteFields",
        [IDX, COL, "id", ["f"], OPTS],
        true,
      ],
      [
        "document:exist",
        [IDX, COL, "id"],
        "client",
        "exists",
        [IDX, COL, "id"],
        true,
      ],
      [
        "document:mExists",
        [IDX, COL, ["id"]],
        "client",
        "mExists",
        [IDX, COL, ["id"]],
        true,
      ],
      [
        "document:get",
        [IDX, COL, "id"],
        "client",
        "get",
        [IDX, COL, "id"],
        true,
      ],
      [
        "document:mCreate",
        [IDX, COL, [{ d: 1 }], OPTS],
        "client",
        "mCreate",
        [IDX, COL, [{ d: 1 }], OPTS],
        true,
      ],
      [
        "document:mCreateOrReplace",
        [IDX, COL, [{ d: 1 }], OPTS],
        "client",
        "mCreateOrReplace",
        [IDX, COL, [{ d: 1 }], OPTS],
        true,
      ],
      [
        "document:mDelete",
        [IDX, COL, ["id"], OPTS],
        "client",
        "mDelete",
        [IDX, COL, ["id"], OPTS],
        true,
      ],
      [
        "document:mReplace",
        [IDX, COL, [{ d: 1 }], OPTS],
        "client",
        "mReplace",
        [IDX, COL, [{ d: 1 }], OPTS],
        true,
      ],
      [
        "document:mUpdate",
        [IDX, COL, [{ d: 1 }], OPTS],
        "client",
        "mUpdate",
        [IDX, COL, [{ d: 1 }], OPTS],
        true,
      ],
      [
        "document:mUpsert",
        [IDX, COL, [{ d: 1 }], OPTS],
        "client",
        "mUpsert",
        [IDX, COL, [{ d: 1 }], OPTS],
        true,
      ],
      [
        "document:mGet",
        [IDX, COL, ["id"]],
        "client",
        "mGet",
        [IDX, COL, ["id"]],
        true,
      ],
      [
        "document:replace",
        [IDX, COL, "id", { c: 1 }, OPTS],
        "client",
        "replace",
        [IDX, COL, "id", { c: 1 }, OPTS],
        true,
      ],
      [
        "document:scroll",
        ["scroll-id", OPTS],
        "client",
        "scroll",
        ["scroll-id", OPTS],
      ],
      [
        "document:update",
        [IDX, COL, "id", { c: 1 }, OPTS],
        "client",
        "update",
        [IDX, COL, "id", { c: 1 }, OPTS],
        true,
      ],
      [
        "document:updateByQuery",
        [IDX, COL, { q: 1 }, { c: 1 }, OPTS],
        "client",
        "updateByQuery",
        [IDX, COL, { q: 1 }, { c: 1 }, OPTS],
        true,
      ],
      [
        "bulk:updateByQuery",
        [IDX, COL, { q: 1 }, { c: 1 }, OPTS],
        "client",
        "bulkUpdateByQuery",
        [IDX, COL, { q: 1 }, { c: 1 }, OPTS],
        true,
      ],
      [
        "document:upsert",
        [IDX, COL, "id", { c: 1 }, OPTS],
        "client",
        "upsert",
        [IDX, COL, "id", { c: 1 }, OPTS],
        true,
      ],

      [
        "mappings:get",
        [IDX, COL, OPTS],
        "client",
        "getMapping",
        [IDX, COL, OPTS],
        true,
      ],
      [
        "mappings:update",
        [IDX, COL, { m: 1 }],
        "client",
        "updateMapping",
        [IDX, COL, { m: 1 }],
        true,
      ],

      ["collection:lock:get", [IDX, COL], "cache", "getLock", [IDX, COL]],

      ["cache:addIndex", [IDX], "cache", "addIndex", [IDX]],
      ["cache:addCollection", [IDX, COL], "cache", "addCollection", [IDX, COL]],
      [
        "cache:removeCollection",
        [IDX, COL],
        "cache",
        "removeCollection",
        [IDX, COL],
      ],
      [
        "cache:setLock",
        [IDX, COL, { owner: "o" }],
        "cache",
        "setLock",
        [IDX, COL, { owner: "o" }],
      ],
      ["cache:removeLock", [IDX, COL], "cache", "removeLock", [IDX, COL]],
    ];

    /** The rows a collection write lock rejects; every other row is a read. */
    const WRITES = new Set([
      "collection:truncate",
      "collection:update",
      "document:bulk",
      "document:create",
      "document:createOrReplace",
      "document:delete",
      "document:deleteByQuery",
      "document:deleteFields",
      "document:mCreate",
      "document:mCreateOrReplace",
      "document:mDelete",
      "document:mReplace",
      "document:mUpdate",
      "document:mUpsert",
      "document:replace",
      "document:update",
      "document:updateByQuery",
      "bulk:updateByQuery",
      "document:upsert",
      "mappings:update",
    ]);

    it.each(rows)(
      "%s forwards to %s.%s",
      async (event, args, target, method, expected, assertsCollection) => {
        const recorder = target === "client" ? client : cache;

        await ask(event, ...args);

        expect(recorder[method]).toHaveBeenCalledOnce();
        expect(recorder[method]).toHaveBeenCalledWith(...expected);

        if (assertsCollection) {
          expect(cache.assertCollectionExists).toHaveBeenCalledWith(IDX, COL);
        } else {
          expect(cache.assertCollectionExists).not.toHaveBeenCalled();
        }

        if (WRITES.has(event)) {
          expect(cache.assertCollectionWritable).toHaveBeenCalledWith(IDX, COL);
        } else {
          expect(cache.assertCollectionWritable).not.toHaveBeenCalled();
        }
      },
    );

    it.each([...WRITES])(
      "%s writes nothing to a locked collection",
      async (event) => {
        const [, args, , method] = rows.find(([e]) => e === event) as Row;

        cache.assertCollectionWritable.mockImplementation(() => {
          throw new Error("locked");
        });

        expect(() => ask(event, ...args)).toThrow("locked");
        expect(client[method]).not.toHaveBeenCalled();
      },
    );

    it("covers every registered event", () => {
      // Guards the table against drift: any handler not exercised above must be
      // covered by one of the dedicated blocks below.
      const dedicated = [
        "cache:refresh",
        "cache:reload",
        "collection:create",
        "collection:delete",
        "index:create",
        "index:delete",
        "index:mDelete",
        "document:import",
        "document:mExecute",
        "document:search",
        "document:multiSearch",
        "mappings:import",
        "cache:removeIndexes",
        "collection:lock",
        "collection:unlock",
      ];
      const tabled = rows.map(([event]) => event);

      expect(new Set([...tabled, ...dedicated]).size).toBe(handlers.size);
    });
  });

  // ------------------------------------------------- optional driver members
  //
  // The engine hooks and the capability groups are optional in the
  // `StorageDriver` contract (ADR-0003).
  describe("a driver without the optional members", () => {
    it("skips the engine hooks it lacks", async () => {
      delete client.generateMissingAliases;
      delete client.waitForCollectionShards;
      (
        globalThis as {
          kuzzle: {
            config: {
              services: { storageEngine: { generateMissingAliases: boolean } };
            };
          };
        }
      ).kuzzle.config.services.storageEngine.generateMissingAliases = true;

      await expect(adapter.populateCache()).resolves.toBeUndefined();
      // `kuzzle.ask` awaits the answer: none is a resolved `undefined`.
      expect(
        ask("collection:shards:wait", "an-index", "a-collection"),
      ).toBeUndefined();
    });
  });

  describe("a driver without every capability", () => {
    it.each([
      ["collection:update", "updateCollection", "mappingUpdates"],
      ["document:updateByQuery", "updateByQuery", "updateByQuery"],
      ["bulk:updateByQuery", "bulkUpdateByQuery", "updateByQuery"],
      ["mappings:update", "updateMapping", "mappingUpdates"],
      ["index:stats", "stats", "stats"],
    ])(
      "%s is rejected unless %s's capability is declared",
      (event, method, capability) => {
        adapter.capabilities = new Set(
          STORAGE_CAPABILITIES.filter((name) => name !== capability),
        );

        expect(() => ask(event, "an-index", "a-collection", {})).toThrow(
          expect.objectContaining({
            id: "services.storage_driver.unsupported_capability",
            message: expect.stringContaining(`"${capability}"`),
          }),
        );
        expect(client[method]).not.toHaveBeenCalled();
      },
    );

    it.each(["aggregations", "aggs"])(
      "rejects a search with %s unless aggregations are declared",
      (field) => {
        adapter.capabilities = new Set(["stats"]);
        const searchBody = {
          [field]: { count: { value_count: { field: "a" } } },
        };
        const rejected = expect.objectContaining({
          id: "services.storage_driver.unsupported_capability",
          message: expect.stringContaining('"aggregations"'),
        });

        expect(() => ask("document:search", "i", "c", searchBody, {})).toThrow(
          rejected,
        );
        expect(() =>
          ask(
            "document:multiSearch",
            [{ collections: ["c"], index: "i" }],
            searchBody,
            {},
          ),
        ).toThrow(rejected);
        expect(client.search).not.toHaveBeenCalled();
      },
    );

    it("searches without aggregations whatever is declared", async () => {
      adapter.capabilities = new Set();

      await ask("document:search", "i", "c", { query: {} }, {});

      expect(client.search).toHaveBeenCalledOnce();
    });
  });

  // ------------------------------------------------------- handlers that reshape
  describe("handlers that reshape their arguments", () => {
    it("document:search wraps index/collection into a target object", async () => {
      await ask("document:search", "i", "c", { query: 1 }, { size: 10 });

      expect(cache.assertCollectionExists).toHaveBeenCalledWith("i", "c");
      expect(client.search).toHaveBeenCalledWith(
        { collection: "c", index: "i", searchBody: { query: 1 } },
        { size: 10 },
      );
    });

    it("document:multiSearch asserts every target, then searches them at once", async () => {
      const targets = [
        { collections: ["c1", "c2"], index: "i1" },
        { collections: ["c3"], index: "i2" },
      ];

      await ask("document:multiSearch", targets, { query: 1 }, { size: 10 });

      // One assertion per (index, collection) pair, not per target.
      expect(cache.assertCollectionExists).toHaveBeenCalledTimes(3);
      expect(cache.assertCollectionExists).toHaveBeenCalledWith("i1", "c1");
      expect(cache.assertCollectionExists).toHaveBeenCalledWith("i1", "c2");
      expect(cache.assertCollectionExists).toHaveBeenCalledWith("i2", "c3");
      expect(client.search).toHaveBeenCalledWith(
        { searchBody: { query: 1 }, targets },
        { size: 10 },
      );
    });

    it("document:mExecute forwards the callback and the options through", async () => {
      const callback = vi.fn();

      await ask("document:mExecute", "i", "c", { query: 1 }, callback, {
        size: 5,
      });

      expect(cache.assertCollectionExists).toHaveBeenCalledWith("i", "c");
      expect(client.mExecute).toHaveBeenCalledWith(
        "i",
        "c",
        { query: 1 },
        callback,
        { size: 5 },
      );
    });

    it("cache:removeIndexes removes each index in turn", async () => {
      await ask("cache:removeIndexes", ["i1", "i2", "i3"]);

      expect(cache.removeIndex).toHaveBeenCalledTimes(3);
      expect(cache.removeIndex).toHaveBeenNthCalledWith(1, "i1");
      expect(cache.removeIndex).toHaveBeenNthCalledWith(3, "i3");
    });
  });

  // ------------------------------------------------- handlers delegating to self
  describe("handlers delegating to the adapter's own methods", () => {
    it("dispatches to the matching method", async () => {
      const spies = {
        "cache:refresh": vi.spyOn(adapter, "populateCache"),
        "cache:reload": vi.spyOn(adapter, "reloadCache"),
        "collection:create": vi.spyOn(adapter, "createCollection"),
        "collection:delete": vi.spyOn(adapter, "deleteCollection"),
        "index:create": vi.spyOn(adapter, "createIndex"),
        "index:delete": vi.spyOn(adapter, "deleteIndex"),
        "index:mDelete": vi.spyOn(adapter, "deleteIndexes"),
        "document:import": vi.spyOn(adapter, "loadFixtures"),
        "mappings:import": vi.spyOn(adapter, "loadMappings"),
        "collection:lock": vi.spyOn(adapter, "lockCollection"),
        "collection:unlock": vi.spyOn(adapter, "unlockCollection"),
      };

      for (const spy of Object.values(spies)) {
        spy.mockResolvedValue(undefined as never);
      }

      await ask("cache:refresh");
      await ask("cache:reload");
      await ask("collection:create", "i", "c", { o: 1 }, { p: 1 });
      await ask("collection:delete", "i", "c");
      await ask("index:create", "i", { o: 1 });
      await ask("index:delete", "i");
      await ask("index:mDelete", ["i"]);
      await ask("document:import", { i: {} }, { o: 1 });
      await ask("mappings:import", { i: {} }, { o: 1 });
      await ask("collection:lock", "i", "c", { owner: "o", reason: "r" });
      await ask("collection:unlock", "i", "c", "o");

      for (const [event, spy] of Object.entries(spies)) {
        expect(spy, event).toHaveBeenCalledOnce();
      }

      expect(spies["collection:create"]).toHaveBeenCalledWith(
        "i",
        "c",
        { o: 1 },
        { p: 1 },
      );
      expect(spies["index:mDelete"]).toHaveBeenCalledWith(["i"]);
      expect(spies["collection:lock"]).toHaveBeenCalledWith("i", "c", {
        owner: "o",
        reason: "r",
      });
      expect(spies["collection:unlock"]).toHaveBeenCalledWith("i", "c", "o");
    });
  });

  // ------------------------------------------------------------ own method logic
  describe("#createIndex", () => {
    it("creates, caches and announces the index", async () => {
      cache.hasIndex.mockReturnValue(false);

      await adapter.createIndex("i");

      expect(client.createIndex).toHaveBeenCalledWith("i");
      expect(cache.addIndex).toHaveBeenCalledWith("i");
      expect(emitted).toContainEqual({
        event: "core:storage:index:create:after",
        payload: { index: "i", scope: storeScopeEnum.PRIVATE },
      });
    });

    it("rejects when the index is already cached", async () => {
      cache.hasIndex.mockReturnValue(true);

      await expect(adapter.createIndex("i")).rejects.toMatchObject({
        id: "services.storage.index_already_exists",
      });
      expect(client.createIndex).not.toHaveBeenCalled();
    });

    /* kuzzle#3029: a peer created it, and its cache broadcast never came. */
    it("caches an index that already exists in storage, then rejects", async () => {
      const error = kerror.get(
        "services",
        "storage",
        "index_already_exists",
        "public",
        "i",
      );
      cache.hasIndex.mockReturnValue(false);
      client.createIndex.mockRejectedValueOnce(error);

      await expect(adapter.createIndex("i")).rejects.toBe(error);

      expect(cache.addIndex).toHaveBeenCalledWith("i");
      expect(emitted).toHaveLength(0);
    });

    it("does not cache the index on any other storage error", async () => {
      const error = new Error("boom");
      cache.hasIndex.mockReturnValue(false);
      cache.addIndex.mockClear();
      client.createIndex.mockRejectedValueOnce(error);

      await expect(adapter.createIndex("i")).rejects.toBe(error);

      expect(cache.addIndex).not.toHaveBeenCalled();
      expect(emitted).toHaveLength(0);
    });

    it("skips the storage write with indexCacheOnly", async () => {
      cache.hasIndex.mockReturnValue(false);

      await adapter.createIndex("i", { indexCacheOnly: true });

      expect(client.createIndex).not.toHaveBeenCalled();
      expect(cache.addIndex).toHaveBeenCalledWith("i");
    });

    it("stays quiet with propagate: false", async () => {
      cache.hasIndex.mockReturnValue(false);

      await adapter.createIndex("i", { propagate: false });

      expect(emitted).toHaveLength(0);
    });
  });

  describe("#createCollection", () => {
    it("creates, caches and announces the collection", async () => {
      await adapter.createCollection("i", "c", { mappings: {} });

      expect(client.createCollection).toHaveBeenCalledWith("i", "c", {
        mappings: {},
      });
      expect(cache.addCollection).toHaveBeenCalledWith("i", "c");
      expect(emitted).toContainEqual({
        event: "core:storage:collection:create:after",
        payload: { collection: "c", index: "i", scope: storeScopeEnum.PRIVATE },
      });
    });

    it("honours indexCacheOnly and propagate", async () => {
      await adapter.createCollection(
        "i",
        "c",
        {},
        { indexCacheOnly: true, propagate: false },
      );

      expect(client.createCollection).not.toHaveBeenCalled();
      expect(cache.addCollection).toHaveBeenCalledWith("i", "c");
      expect(emitted).toHaveLength(0);
      // Cluster sync replays a creation another node made: nothing to reject.
      expect(cache.assertCollectionWritable).not.toHaveBeenCalled();
    });

    /* Creating an existing collection updates its mappings. */
    it("does not touch a locked collection", async () => {
      cache.assertCollectionWritable.mockImplementation(() => {
        throw new Error("locked");
      });

      await expect(adapter.createCollection("i", "c", {})).rejects.toThrow(
        "locked",
      );
      expect(cache.assertCollectionWritable).toHaveBeenCalledWith("i", "c");
      expect(client.createCollection).not.toHaveBeenCalled();
    });
  });

  describe("#deleteIndex", () => {
    it("asserts, deletes, un-caches and announces", async () => {
      await adapter.deleteIndex("i");

      expect(cache.assertIndexExists).toHaveBeenCalledWith("i");
      expect(client.deleteIndex).toHaveBeenCalledWith("i");
      expect(cache.removeIndex).toHaveBeenCalledWith("i");
      expect(emitted).toContainEqual({
        event: "core:storage:index:delete:after",
        payload: { index: "i", scope: storeScopeEnum.PRIVATE },
      });
    });

    it("does not delete an index holding a locked collection", async () => {
      cache.assertIndexWritable.mockImplementation(() => {
        throw new Error("locked");
      });

      await expect(adapter.deleteIndex("i")).rejects.toThrow("locked");
      expect(cache.assertIndexWritable).toHaveBeenCalledWith("i");
      expect(client.deleteIndex).not.toHaveBeenCalled();
    });
  });

  describe("#deleteIndexes", () => {
    it("asserts every index, then announces only what was deleted", async () => {
      client.deleteIndexes.mockResolvedValue(["i1", "i3"]);

      const deleted = await adapter.deleteIndexes(["i1", "i2", "i3"]);

      expect(deleted).toEqual(["i1", "i3"]);
      expect(cache.assertIndexExists).toHaveBeenCalledTimes(3);
      expect(cache.removeIndex).toHaveBeenCalledTimes(2);
      expect(emitted).toContainEqual({
        event: "core:storage:index:mDelete:after",
        payload: { indexes: ["i1", "i3"], scope: storeScopeEnum.PRIVATE },
      });
    });

    it("announces nothing when nothing was deleted", async () => {
      client.deleteIndexes.mockResolvedValue([]);

      await adapter.deleteIndexes(["i1"]);

      expect(cache.removeIndex).not.toHaveBeenCalled();
      expect(emitted).toHaveLength(0);
    });

    it("deletes nothing if one index holds a locked collection", async () => {
      cache.assertIndexWritable.mockImplementation((index: string) => {
        if (index === "i2") {
          throw new Error("locked");
        }
      });

      await expect(adapter.deleteIndexes(["i1", "i2"])).rejects.toThrow(
        "locked",
      );
      expect(client.deleteIndexes).not.toHaveBeenCalled();
    });
  });

  describe("#deleteCollection", () => {
    it("asserts, deletes, un-caches and announces", async () => {
      await adapter.deleteCollection("i", "c");

      expect(cache.assertCollectionExists).toHaveBeenCalledWith("i", "c");
      expect(client.deleteCollection).toHaveBeenCalledWith("i", "c");
      expect(cache.removeCollection).toHaveBeenCalledWith("i", "c");
      expect(emitted).toContainEqual({
        event: "core:storage:collection:delete:after",
        payload: { collection: "c", index: "i", scope: storeScopeEnum.PRIVATE },
      });
    });

    it("does not delete a locked collection", async () => {
      cache.assertCollectionWritable.mockImplementation(() => {
        throw new Error("locked");
      });

      await expect(adapter.deleteCollection("i", "c")).rejects.toThrow(
        "locked",
      );
      expect(client.deleteCollection).not.toHaveBeenCalled();
    });
  });

  describe("#populateCache", () => {
    it("mirrors the storage schema into the cache", async () => {
      const snapshot = new Map();
      client.getSchema.mockResolvedValue({ i1: ["c1", "c2"], i2: [] });
      cache.snapshotIndexes.mockReturnValue(snapshot);

      await adapter.populateCache();

      expect(cache.replaceIndexes).toHaveBeenLastCalledWith(
        { i1: ["c1", "c2"], i2: [] },
        snapshot,
      );
    });

    it("generates the missing aliases first when configured to", async () => {
      (
        globalThis as {
          kuzzle: {
            config: {
              services: { storageEngine: { generateMissingAliases: boolean } };
            };
          };
        }
      ).kuzzle.config.services.storageEngine.generateMissingAliases = true;

      await adapter.populateCache();

      expect(client.generateMissingAliases).toHaveBeenCalledOnce();
    });

    it("loads the collection write locks too", async () => {
      const loadLocks = vi.spyOn(adapter, "loadLocks");

      await adapter.populateCache();

      expect(loadLocks).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------- collection write locks
  describe("collection write locks", () => {
    const KEY = "{core/storage}/collection-locks/private";
    const FIELD = JSON.stringify(["i", "c"]);
    const options = { owner: "mapping-migration", reason: "job-1" };

    const stored = () => {
      const value = redis.get(KEY)?.get(FIELD);

      return value === undefined ? undefined : JSON.parse(value);
    };

    beforeEach(() => {
      vi.spyOn(Date, "now").mockReturnValue(42);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe("#lockCollection", () => {
      it("stores, caches and announces the lock", async () => {
        const lock = { lockedAt: 42, ...options };

        await expect(
          adapter.lockCollection("i", "c", options),
        ).resolves.toEqual(lock);

        expect(cache.assertCollectionExists).toHaveBeenCalledWith("i", "c");
        expect(stored()).toEqual(lock);
        expect(cache.setLock).toHaveBeenCalledWith("i", "c", lock);
        expect(emitted).toContainEqual({
          event: "core:storage:collection:lock:after",
          payload: {
            collection: "c",
            index: "i",
            lock,
            scope: storeScopeEnum.PRIVATE,
          },
        });
      });

      it("refreshes a lock its owner takes again", async () => {
        await adapter.lockCollection("i", "c", options);
        vi.mocked(Date.now).mockReturnValue(43);

        await adapter.lockCollection("i", "c", { ...options, reason: "job-2" });

        expect(stored()).toEqual({ ...options, lockedAt: 43, reason: "job-2" });
      });

      /* Redis decides, not the local cache: the other owner may have locked
       * the collection on another node a moment ago. */
      it("rejects a collection locked by another owner", async () => {
        await adapter.lockCollection("i", "c", { owner: "other", reason: "r" });
        cache.setLock.mockClear();
        emitted.length = 0;

        await expect(
          adapter.lockCollection("i", "c", options),
        ).rejects.toMatchObject({
          id: "services.storage.collection_locked",
          message:
            'The collection "i":"c" is locked by "other" (r): write actions are rejected until it is unlocked.',
        });
        expect(stored()).toMatchObject({ owner: "other" });
        expect(cache.setLock).not.toHaveBeenCalled();
        expect(emitted).toHaveLength(0);
      });

      it("rejects an unknown collection", async () => {
        cache.assertCollectionExists.mockImplementation(() => {
          throw new Error("unknown");
        });

        await expect(adapter.lockCollection("i", "c", options)).rejects.toThrow(
          "unknown",
        );
        expect(stored()).toBeUndefined();
      });
    });

    describe("#unlockCollection", () => {
      it("removes, un-caches and announces the lock", async () => {
        await adapter.lockCollection("i", "c", options);

        await expect(
          adapter.unlockCollection("i", "c", options.owner),
        ).resolves.toBe(true);

        expect(stored()).toBeUndefined();
        expect(cache.removeLock).toHaveBeenCalledWith("i", "c");
        expect(emitted).toContainEqual({
          event: "core:storage:collection:unlock:after",
          payload: {
            collection: "c",
            index: "i",
            scope: storeScopeEnum.PRIVATE,
          },
        });
      });

      it("answers false for a collection that is not locked", async () => {
        await expect(
          adapter.unlockCollection("i", "c", options.owner),
        ).resolves.toBe(false);

        // A stale local copy is dropped all the same.
        expect(cache.removeLock).toHaveBeenCalledWith("i", "c");
        expect(emitted).toHaveLength(0);
      });

      it("rejects another owner", async () => {
        await adapter.lockCollection("i", "c", options);
        emitted.length = 0;

        await expect(
          adapter.unlockCollection("i", "c", "other"),
        ).rejects.toMatchObject({ id: "services.storage.collection_locked" });
        expect(stored()).toMatchObject(options);
        expect(emitted).toHaveLength(0);
      });
    });

    describe("#loadLocks", () => {
      it("replaces the cached locks with the stored ones", async () => {
        const lock = { lockedAt: 1, ...options };

        redis.set(
          KEY,
          new Map([
            [FIELD, JSON.stringify(lock)],
            [JSON.stringify(["i", "c.d"]), JSON.stringify(lock)],
          ]),
        );

        const snapshot = new Map();
        cache.snapshotLocks.mockReturnValue(snapshot);

        await adapter.loadLocks();

        expect(cache.replaceLocks).toHaveBeenLastCalledWith(
          new Map([
            [
              "i",
              new Map([
                ["c", lock],
                ["c.d", lock],
              ]),
            ],
          ]),
          snapshot,
        );
      });

      it("keeps each scope's locks apart", async () => {
        redis.set(
          "{core/storage}/collection-locks/public",
          new Map([[FIELD, JSON.stringify({ lockedAt: 1, ...options })]]),
        );

        await adapter.loadLocks();

        expect(cache.replaceLocks).toHaveBeenLastCalledWith(
          new Map(),
          undefined,
        );
      });
    });
  });

  describe("#loadFixtures", () => {
    it("imports every collection payload, asserting each collection", async () => {
      await adapter.loadFixtures({
        i1: { c1: [{ a: 1 }], c2: [{ b: 2 }] },
      } as never);

      expect(cache.assertCollectionExists).toHaveBeenCalledWith("i1", "c1");
      expect(cache.assertCollectionExists).toHaveBeenCalledWith("i1", "c2");
      expect(client.import).toHaveBeenCalledTimes(2);
      expect(client.import).toHaveBeenCalledWith("i1", "c1", [{ a: 1 }], {
        refresh: "wait_for",
      });
    });

    it("imports nothing into a locked collection", async () => {
      cache.assertCollectionWritable.mockImplementation(() => {
        throw new Error("locked");
      });

      await expect(
        adapter.loadFixtures({ i1: { c1: [{ a: 1 }] } } as never),
      ).rejects.toThrow("locked");
      expect(client.import).not.toHaveBeenCalled();
    });

    it("rejects a non-object payload, at either level", async () => {
      await expect(adapter.loadFixtures("nope" as never)).rejects.toMatchObject(
        { id: "api.assert.invalid_argument" },
      );
      await expect(
        adapter.loadFixtures({ i1: "nope" } as never),
      ).rejects.toMatchObject({ id: "api.assert.invalid_argument" });
    });

    it("rejects when the import reports errors", async () => {
      client.import.mockResolvedValue({ errors: [{ some: "error" }] });

      await expect(
        adapter.loadFixtures({ i1: { c1: [] } } as never),
      ).rejects.toMatchObject({ id: "services.storage.import_failed" });
    });
  });

  describe("#loadMappings", () => {
    it("creates the index and the collection for every mapping", async () => {
      const createIndex = vi
        .spyOn(adapter, "createIndex")
        .mockResolvedValue(undefined);
      const createCollection = vi
        .spyOn(adapter, "createCollection")
        .mockResolvedValue(undefined);

      await adapter.loadMappings({ i1: { c1: { properties: {} } } } as never);

      expect(createIndex).toHaveBeenCalledWith("i1", {
        indexCacheOnly: false,
        propagate: true,
      });
      expect(createCollection).toHaveBeenCalledWith(
        "i1",
        "c1",
        { properties: {} },
        { indexCacheOnly: false, propagate: true },
      );
    });

    it("wraps the mapping under `mappings` with rawMappings", async () => {
      vi.spyOn(adapter, "createIndex").mockResolvedValue(undefined);
      const createCollection = vi
        .spyOn(adapter, "createCollection")
        .mockResolvedValue(undefined);

      await adapter.loadMappings({ i1: { c1: { properties: {} } } } as never, {
        rawMappings: true,
      });

      expect(createCollection).toHaveBeenCalledWith(
        "i1",
        "c1",
        { mappings: { properties: {} } },
        expect.anything(),
      );
    });

    it("tolerates an index that already exists — the cluster race", async () => {
      vi.spyOn(adapter, "createIndex").mockRejectedValue(
        Object.assign(new Error("exists"), {
          id: "services.storage.index_already_exists",
        }),
      );
      const createCollection = vi
        .spyOn(adapter, "createCollection")
        .mockResolvedValue(undefined);

      await expect(
        adapter.loadMappings({ i1: { c1: {} } } as never),
      ).resolves.toBeUndefined();
      expect(createCollection).toHaveBeenCalledOnce();
    });

    it("rethrows any other index-creation failure", async () => {
      vi.spyOn(adapter, "createIndex").mockRejectedValue(
        Object.assign(new Error("boom"), { id: "services.storage.other" }),
      );

      await expect(
        adapter.loadMappings({ i1: { c1: {} } } as never),
      ).rejects.toThrow("boom");
    });

    it("refreshes the collection when asked, unless it is cache-only", async () => {
      vi.spyOn(adapter, "createIndex").mockResolvedValue(undefined);
      vi.spyOn(adapter, "createCollection").mockResolvedValue(undefined);

      await adapter.loadMappings({ i1: { c1: {} } } as never, {
        refresh: true,
      });
      expect(client.refreshCollection).toHaveBeenCalledWith("i1", "c1");

      client.refreshCollection.mockClear();
      await adapter.loadMappings({ i1: { c1: {} } } as never, {
        indexCacheOnly: true,
        refresh: true,
      });
      expect(client.refreshCollection).not.toHaveBeenCalled();
    });

    it("loads the mappings under the loadMappings lock, with no retry limit", async () => {
      const heldDuring: boolean[] = [];
      vi.spyOn(adapter, "createIndex").mockResolvedValue(undefined);
      vi.spyOn(adapter, "createCollection").mockImplementation(async () => {
        heldDuring.push(locks.taken[0]?.held ?? false);
      });

      await adapter.loadMappings({ i1: { c1: {}, c2: {} } } as never);

      // Waits forever and keeps the 60 s TTL, as the `Mutex` it replaces did.
      expect(locks.taken).toEqual([
        {
          config: { retryAttempts: Number.POSITIVE_INFINITY, ttl: 60000 },
          held: false,
          resource: "loadMappings",
        },
      ]);
      expect(heldDuring).toEqual([true, true]);
    });

    it("gives the lock back when a mapping fails to load", async () => {
      vi.spyOn(adapter, "createIndex").mockRejectedValue(new Error("boom"));

      await expect(
        adapter.loadMappings({ i1: { c1: {} } } as never),
      ).rejects.toThrow("boom");
      expect(locks.taken).toMatchObject([
        { held: false, resource: "loadMappings" },
      ]);
    });

    it("rejects with MutexLockLostError when the lock is lost", async () => {
      vi.spyOn(adapter, "createIndex").mockResolvedValue(undefined);
      vi.spyOn(adapter, "createCollection").mockResolvedValue(undefined);
      vi.mocked(withLock).mockRejectedValueOnce(
        new MutexLockLostError("loadMappings"),
      );

      await expect(
        adapter.loadMappings({ i1: { c1: {} } } as never),
      ).rejects.toBeInstanceOf(MutexLockLostError);
    });

    it("rejects a non-object payload before taking the lock", async () => {
      await expect(adapter.loadMappings("nope" as never)).rejects.toMatchObject(
        { id: "api.assert.invalid_argument" },
      );
      expect(locks.taken).toEqual([]);
    });

    it("rejects a non-object payload, at either level", async () => {
      await expect(adapter.loadMappings("nope" as never)).rejects.toMatchObject(
        { id: "api.assert.invalid_argument" },
      );
      await expect(
        adapter.loadMappings({ i1: "nope" } as never),
      ).rejects.toMatchObject({ id: "api.assert.invalid_argument" });
    });
  });

  it("declares the client and cache method sets this spec relies on", () => {
    // Cheap drift guard: if a method disappears from the mock, the rows above
    // would silently assert against `undefined`.
    for (const m of CLIENT_METHODS) {
      expect(client[m], `client.${m}`).toBeDefined();
    }
    for (const m of CACHE_METHODS) {
      expect(cache[m], `cache.${m}`).toBeDefined();
    }
  });
});
