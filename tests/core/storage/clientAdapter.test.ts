import { beforeEach, describe, expect, it, vi } from "vitest";

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
] as const;

const CACHE_METHODS = [
  "addCollection",
  "addIndex",
  "assertCollectionExists",
  "assertIndexExists",
  "hasCollection",
  "hasIndex",
  "listCollections",
  "listIndexes",
  "removeCollection",
  "removeIndex",
] as const;

type Recorder = Record<string, ReturnType<typeof vi.fn>>;

const { esInstances, cacheInstances, ElasticsearchMock, IndexCacheMock } =
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
    ];
    const cacheMethods = [
      "addCollection",
      "addIndex",
      "assertCollectionExists",
      "assertIndexExists",
      "hasCollection",
      "hasIndex",
      "listCollections",
      "listIndexes",
      "removeCollection",
      "removeIndex",
    ];
    const createdEs: unknown[] = [];
    const createdCache: unknown[] = [];

    return {
      esInstances: createdEs,
      cacheInstances: createdCache,
      ElasticsearchMock: class {
        public client: Record<string, ReturnType<typeof vi.fn>> = {};
        public init = vi.fn(async () => undefined);

        constructor(
          public config: unknown,
          public scope: unknown,
        ) {
          for (const m of clientMethods) {
            this.client[m] = vi.fn(async () => undefined);
          }
          // The two client calls whose RESULT drives control flow.
          this.client.getSchema = vi.fn(async () => ({}));
          this.client.deleteIndexes = vi.fn(async () => [] as string[]);
          this.client.import = vi.fn(async () => ({ errors: [] }));
          createdEs.push(this);
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

vi.mock("../../../lib/service/storage/Elasticsearch", () => ({
  Elasticsearch: ElasticsearchMock,
}));
vi.mock("../../../lib/core/storage/indexCache", () => ({
  IndexCache: IndexCacheMock,
}));

import ClientAdapter from "../../../lib/core/storage/clientAdapter";

describe("#core/storage/ClientAdapter", () => {
  let adapter: ClientAdapter;
  let handlers: Map<string, (...args: unknown[]) => unknown>;
  let emitted: Array<{ event: string; payload: unknown }>;
  let client: Recorder;
  let cache: Recorder;

  /** Invokes a registered ask handler by its event suffix. */
  const ask = (suffix: string, ...args: unknown[]) => {
    const handler = handlers.get(`core:storage:private:${suffix}`);

    expect(handler, `no handler registered for "${suffix}"`).toBeDefined();

    return handler(...args);
  };

  beforeEach(async () => {
    esInstances.length = 0;
    cacheInstances.length = 0;
    handlers = new Map();
    emitted = [];

    (globalThis as { kuzzle?: unknown }).kuzzle = {
      config: {
        services: {
          storageEngine: { generateMissingAliases: false },
        },
      },
      emit: vi.fn((event: string, payload: unknown) => {
        emitted.push({ event, payload });
      }),
      onAsk: vi.fn((event: string, handler: (...a: unknown[]) => unknown) => {
        handlers.set(event, handler);
      }),
      // `loadMappings` takes a Mutex, which reaches the cache through `ask`.
      ask: vi.fn(async () => true),
    };

    adapter = new ClientAdapter(storeScopeEnum.PRIVATE);
    await adapter.init();

    client = adapter.client as Recorder;
    cache = adapter.cache as unknown as Recorder;
  });

  describe("#constructor", () => {
    it("builds one ES service for the scope, plus an index cache", () => {
      expect(esInstances).toHaveLength(1);
      expect(cacheInstances).toHaveLength(1);
      expect(adapter.scope).toBe(storeScopeEnum.PRIVATE);
      expect(adapter.client).toBe(
        (esInstances[0] as { client: unknown }).client,
      );
    });
  });

  describe("#init", () => {
    it("initialises the ES service and populates the cache before registering", () => {
      expect(adapter.es.init).toHaveBeenCalledOnce();
      expect(client.getSchema).toHaveBeenCalledOnce();
      // Every documented ask event is registered.
      expect(handlers.size).toBe(51);
    });

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

      ["cache:addIndex", [IDX], "cache", "addIndex", [IDX]],
      ["cache:addCollection", [IDX, COL], "cache", "addCollection", [IDX, COL]],
      [
        "cache:removeCollection",
        [IDX, COL],
        "cache",
        "removeCollection",
        [IDX, COL],
      ],
    ];

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
      },
    );

    it("covers every registered event", () => {
      // Guards the table against drift: any handler not exercised above must be
      // covered by one of the dedicated blocks below.
      const dedicated = [
        "cache:refresh",
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
      ];
      const tabled = rows.map(([event]) => event);

      expect(new Set([...tabled, ...dedicated]).size).toBe(handlers.size);
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
        "collection:create": vi.spyOn(adapter, "createCollection"),
        "collection:delete": vi.spyOn(adapter, "deleteCollection"),
        "index:create": vi.spyOn(adapter, "createIndex"),
        "index:delete": vi.spyOn(adapter, "deleteIndex"),
        "index:mDelete": vi.spyOn(adapter, "deleteIndexes"),
        "document:import": vi.spyOn(adapter, "loadFixtures"),
        "mappings:import": vi.spyOn(adapter, "loadMappings"),
      };

      for (const spy of Object.values(spies)) {
        spy.mockResolvedValue(undefined as never);
      }

      await ask("cache:refresh");
      await ask("collection:create", "i", "c", { o: 1 }, { p: 1 });
      await ask("collection:delete", "i", "c");
      await ask("index:create", "i", { o: 1 });
      await ask("index:delete", "i");
      await ask("index:mDelete", ["i"]);
      await ask("document:import", { i: {} }, { o: 1 });
      await ask("mappings:import", { i: {} }, { o: 1 });

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
  });

  describe("#populateCache", () => {
    it("mirrors the storage schema into the cache", async () => {
      client.getSchema.mockResolvedValue({ i1: ["c1", "c2"], i2: [] });
      cache.addIndex.mockClear();
      cache.addCollection.mockClear();

      await adapter.populateCache();

      expect(cache.addIndex).toHaveBeenCalledWith("i1");
      expect(cache.addIndex).toHaveBeenCalledWith("i2");
      expect(cache.addCollection).toHaveBeenCalledWith("i1", "c1");
      expect(cache.addCollection).toHaveBeenCalledWith("i1", "c2");
      expect(cache.addCollection).toHaveBeenCalledTimes(2);
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
