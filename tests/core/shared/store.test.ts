import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Store } from "../../../lib/core/shared/store";
import { storeScopeEnum } from "../../../lib/core/storage/storeScopeEnum";
import { MutexLockLostError } from "../../../lib/util/distributedLock";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

const INDEX = "some-index";

/**
 * Every lock taken through `withLock`: its options, whether it is held right
 * now, and whether it was given back. `lost` makes the next lock be lost
 * while its callback runs, as `withLock` reports it.
 */
const locks = vi.hoisted(() => {
  const taken: {
    config: { retryAttempts?: number; ttl?: number } | undefined;
    held: boolean;
    released: boolean;
    resource: string;
  }[] = [];

  return { lost: false, taken };
});

vi.mock("../../../lib/util/distributedLock", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../lib/util/distributedLock")>();

  return {
    ...actual,
    withLock: vi.fn(
      async (
        resource: string,
        callback: () => Promise<unknown>,
        config?: { retryAttempts?: number; ttl?: number },
      ) => {
        const lock = { config, held: true, released: false, resource };
        locks.taken.push(lock);

        try {
          const running = callback();

          if (locks.lost) {
            running.catch(() => undefined);
            throw new actual.MutexLockLostError(resource);
          }

          return await running;
        } finally {
          lock.held = false;
          lock.released = true;
        }
      },
    ),
  };
});

describe("#core/shared/Store", () => {
  let store: Store;
  let ask: ReturnType<typeof vi.fn>;
  /** What `ask` answers, per event (`undefined` for the others). */
  let answers: Record<string, unknown>;
  /** Every `ask`: its event, its arguments, and whether the lock was held. */
  let asks: { args: unknown[]; event: string; underLock: boolean }[];

  /** The asks for one `core:storage:public:<suffix>` event, without the event. */
  const asked = (suffix: string) =>
    asks
      .filter(({ event }) => event === `core:storage:public:${suffix}`)
      .map(({ args, underLock }) => ({ args, underLock }));

  beforeEach(() => {
    locks.taken.length = 0;
    locks.lost = false;
    answers = {};
    asks = [];

    ask = vi.fn(async (event: string, ...args: unknown[]) => {
      asks.push({
        args,
        event,
        underLock: locks.taken.some((lock) => lock.held),
      });

      return answers[event];
    });

    stubKuzzle({ ask });

    store = new Store(INDEX, storeScopeEnum.PUBLIC);
  });

  afterEach(() => {
    restoreKuzzle();
    vi.restoreAllMocks();
  });

  describe("#init", () => {
    const settings = { number_of_replicas: 1, number_of_shards: 1 };
    const collections = {
      bar: { mappings: { properties: { bar: { type: "keyword" } } }, settings },
      foo: { mappings: { properties: { foo: { type: "keyword" } } }, settings },
    };

    it("takes the index's lock with no retry limit and the default TTL", async () => {
      await store.init(collections);

      expect(locks.taken).toEqual([
        {
          config: { retryAttempts: Number.POSITIVE_INFINITY },
          held: false,
          released: true,
          resource: `Store.init(${INDEX})`,
        },
      ]);
    });

    /*
     * Every node creates the collections itself (`indexCacheOnly: false`),
     * in turn: there is no longer a node that only fills its cache after
     * waiting for another one to do the work.
     */
    it("creates every collection, not only in the cache, while holding the lock", async () => {
      await store.init(collections);

      expect(asked("collection:create")).toEqual(
        expect.arrayContaining([
          {
            args: [INDEX, "foo", collections.foo, { indexCacheOnly: false }],
            underLock: true,
          },
          {
            args: [INDEX, "bar", collections.bar, { indexCacheOnly: false }],
            underLock: true,
          },
        ]),
      );
      expect(asked("collection:create")).toHaveLength(2);
    });

    /*
     * What a node does once the collections exist (any restart, and every
     * node but the first on a fresh cluster): it only reads them and fills
     * its cache, still under the lock.
     */
    it("only reads an existing collection, then caches it, under the lock", async () => {
      answers["core:storage:public:collection:exist"] = true;
      answers["core:storage:public:collection:settings:get"] = {
        number_of_shards: "1",
      };

      await store.init({ foo: collections.foo });

      expect(asked("collection:exist")).toEqual([
        { args: [INDEX, "foo"], underLock: true },
      ]);
      expect(asked("collection:shards:wait")).toEqual([
        { args: [INDEX, "foo"], underLock: true },
      ]);
      expect(asked("collection:settings:get")).toEqual([
        { args: [INDEX, "foo"], underLock: true },
      ]);
      expect(asked("collection:create")).toEqual([
        {
          args: [
            INDEX,
            "foo",
            {
              mappings: collections.foo.mappings,
              settings: { number_of_replicas: 1 },
            },
            { indexCacheOnly: true },
          ],
          underLock: true,
        },
      ]);
    });

    /*
     * #3033: the node that created a collection asked Elasticsearch to wait
     * for its shards. One that finds it already there may have taken the lock
     * right after its creator stopped, before the primary shard was active,
     * and a document request would then get a 503. So it waits for them
     * before anything else touches the collection.
     */
    it("waits for an existing collection's shards before reading it", async () => {
      answers["core:storage:public:collection:exist"] = true;
      answers["core:storage:public:collection:settings:get"] = {
        number_of_shards: "1",
      };

      await store.init({ foo: collections.foo });

      const events = asks.map(({ event }) => event);

      expect(events.indexOf("core:storage:public:collection:shards:wait")).toBe(
        events.indexOf("core:storage:public:collection:exist") + 1,
      );
    });

    it("does not wait for the shards of a collection it creates", async () => {
      await store.init(collections);

      expect(asked("collection:shards:wait")).toEqual([]);
    });

    it("rejects, and creates nothing, when the shards never become active", async () => {
      const timeout = new Error("timed out");
      answers["core:storage:public:collection:exist"] = true;
      ask.mockImplementation(async (event: string, ...args: unknown[]) => {
        asks.push({ args, event, underLock: true });

        if (event === "core:storage:public:collection:shards:wait") {
          throw timeout;
        }

        return answers[event];
      });

      await expect(store.init({ foo: collections.foo })).rejects.toBe(timeout);

      expect(asked("collection:create")).toEqual([]);
    });

    it("rejects with MutexLockLostError when the lock is lost", async () => {
      locks.lost = true;

      await expect(store.init(collections)).rejects.toBeInstanceOf(
        MutexLockLostError,
      );
    });

    it("rejects, and gives the lock back, when a collection cannot be created", async () => {
      const failure = new Error("ES unreachable");
      ask.mockRejectedValue(failure);

      await expect(store.init(collections)).rejects.toBe(failure);

      expect(locks.taken).toHaveLength(1);
      expect(locks.taken[0].released).toBe(true);
    });
  });

  /*
   * An existing collection's shard count cannot change: in development, a
   * configured `number_of_shards` that differs from it fails the startup.
   */
  describe("#createCollections: number_of_shards check", () => {
    const mappings = { properties: { foo: { type: "keyword" } } };
    let nodeEnv: string | undefined;

    beforeEach(() => {
      nodeEnv = global.NODE_ENV;
      global.NODE_ENV = "development";
      answers["core:storage:public:collection:exist"] = true;
      answers["core:storage:public:collection:settings:get"] = {
        number_of_shards: "1",
      };
    });

    afterEach(() => {
      global.NODE_ENV = nodeEnv;
    });

    it("throws when the configured number_of_shards differs", async () => {
      await expect(
        store.createCollections({
          foo: { mappings, settings: { number_of_shards: 2 } },
        }),
      ).rejects.toMatchObject({
        id: "services.storage.wrong_es_static_settings_for_collection_recreation",
      });
    });

    it("accepts the existing number_of_shards", async () => {
      await store.createCollections({
        foo: { mappings, settings: { number_of_shards: 1 } },
      });

      expect(asked("collection:create")).toHaveLength(1);
    });

    // #3009: `number_of_shards` left out means "not specified", not a mismatch
    it("skips the check when only number_of_replicas is configured", async () => {
      await store.createCollections({
        foo: { mappings, settings: { number_of_replicas: 1 } },
      });

      expect(asked("collection:create")).toEqual([
        {
          args: [
            INDEX,
            "foo",
            { mappings, settings: { number_of_replicas: 1 } },
            { indexCacheOnly: true },
          ],
          underLock: false,
        },
      ]);
    });
  });
});
