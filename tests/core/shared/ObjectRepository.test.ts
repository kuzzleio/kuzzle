import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cacheDbEnum } from "../../../lib/core/cache/cacheDbEnum";
import { ObjectRepository } from "../../../lib/core/shared/ObjectRepository";
import { InternalError } from "../../../lib/kerror/errors/internalError";
import { NotFoundError } from "../../../lib/kerror/errors/notFoundError";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/** What the repository builds out of a stored document. */
class Persisted {
  _id = "";
  some?: string;
  ttl?: number;
}

/**
 * `collection`, `ObjectConstructor`, `cacheDb` and `store` are `protected`:
 * a repository is configured by the subclass that declares it, which is what
 * every one of them in `lib/` does. The Mocha spec assigned them from outside.
 */
class TestRepository extends ObjectRepository<Persisted> {
  constructor(options: ConstructorParameters<typeof ObjectRepository>[0]) {
    super(options);
    this.collection = "objects";
    this.ObjectConstructor = Persisted;
  }

  useCacheDb(db: cacheDbEnum) {
    this.cacheDb = db;
  }

  dropStore() {
    this.store = null;
  }

  useCollection(collection: string) {
    this.collection = collection;
  }
}

const dbPojo = { _id: "someId", _source: { some: "source" }, found: true };
const cachePojo = { _id: "someId", some: "source" };

/**
 * The store is the repository's collaborator, and it is a real object with
 * methods — not a bus. The Mocha spec handed it `kuzzle.internalIndex` (the
 * real `InternalIndexHandler`, whose `init` was stubbed) and then asserted on
 * the `core:storage:private:document:*` events **the handler** emits, so its
 * assertions were about a second subject. Here the store is stubbed and the
 * assertions are about the calls `ObjectRepository` actually makes.
 */
function stubStore() {
  return {
    index: "%kuzzle",
    get: vi.fn(),
    mGet: vi.fn(),
    search: vi.fn(),
    scroll: vi.fn(),
    create: vi.fn(),
    createOrReplace: vi.fn(),
    replace: vi.fn(),
    delete: vi.fn(),
  };
}

describe("#core/shared/ObjectRepository", () => {
  let store: ReturnType<typeof stubStore>;
  let cache: Record<string, ReturnType<typeof vi.fn>>;
  let repository: TestRepository;

  beforeEach(() => {
    store = stubStore();

    /* The cache side is a bus, and these five events are all of it. */
    cache = {
      get: vi.fn(async () => null),
      store: vi.fn(),
      del: vi.fn(),
      expire: vi.fn(),
      persist: vi.fn(),
    };

    stubKuzzle({
      // The one piece of configuration the constructor reads.
      config: { repositories: { common: { cacheTTL: 1440000 } } },
      ask: vi.fn(async (event: string, ...args: unknown[]) => {
        const handler = cache[event.replace("core:cache:internal:", "")];

        if (event.startsWith("core:cache:internal:") && handler) {
          return (handler as (...a: unknown[]) => unknown)(...args);
        }

        throw new Error(`unexpected ask("${event}")`);
      }),
    });

    repository = new TestRepository({ cache: cacheDbEnum.INTERNAL, store });
  });

  afterEach(() => {
    restoreKuzzle();
  });

  describe("#loadOneFromDatabase", () => {
    it("should reject for a non-existing id", async () => {
      store.get.mockRejectedValue(new NotFoundError("Not found"));

      const rejection = repository.loadOneFromDatabase("-9999");

      await expect(rejection).rejects.toBeInstanceOf(NotFoundError);
      await expect(rejection).rejects.toMatchObject({
        id: "services.storage.not_found",
      });
    });

    it("should let any other error through", async () => {
      store.get.mockRejectedValue(new InternalError("error"));

      const rejection = repository.loadOneFromDatabase("error");

      await expect(rejection).rejects.toBeInstanceOf(InternalError);
      await expect(rejection).rejects.toMatchObject({ message: "error" });
    });

    it("should return a valid ObjectConstructor instance if found", async () => {
      store.get.mockResolvedValue(dbPojo);

      const result = await repository.loadOneFromDatabase("persisted");

      expect(result).toBeInstanceOf(Persisted);
      expect(result).toMatchObject({ _id: "someId", some: "source" });
      expect(store.get).toHaveBeenCalledWith("objects", "persisted");
    });
  });

  describe("#loadMultiFromDatabase", () => {
    it("should return an empty array when nothing is found", async () => {
      store.mGet.mockResolvedValue({ items: [] });

      await expect(
        repository.loadMultiFromDatabase(["-999", "-998", "-997"]),
      ).resolves.toEqual([]);
    });

    it("should return one instance per item", async () => {
      store.mGet.mockResolvedValue({ items: [dbPojo, dbPojo] });

      const results = await repository.loadMultiFromDatabase([
        "persisted",
        "persisted",
      ]);

      expect(results).toHaveLength(2);
      for (const result of results) {
        expect(result).toBeInstanceOf(Persisted);
        expect(result).toMatchObject({ _id: "someId", some: "source" });
      }
    });
  });

  describe("#loadFromCache", () => {
    it("should return null for a non-existing id", async () => {
      cache.get.mockResolvedValue(null);

      await expect(repository.loadFromCache("-999")).resolves.toBeNull();
    });

    it("should reject in case of error", async () => {
      cache.get.mockRejectedValue(new InternalError("error"));

      const rejection = repository.loadFromCache("error");

      await expect(rejection).rejects.toBeInstanceOf(InternalError);
      await expect(rejection).rejects.toMatchObject({
        id: "services.cache.read_failed",
      });
    });

    it("should reject when the cache holds something that is not JSON", async () => {
      cache.get.mockResolvedValue("bad type");

      await expect(repository.loadFromCache("string")).rejects.toMatchObject({
        id: "services.cache.read_failed",
      });
    });

    it("should return a valid ObjectConstructor instance if found", async () => {
      cache.get.mockResolvedValue(JSON.stringify(cachePojo));

      const result = await repository.loadFromCache("persisted");

      expect(result).toBeInstanceOf(Persisted);
      expect(result).toMatchObject({ _id: "someId", some: "source" });
    });
  });

  describe("#load", () => {
    it("should reject for a non-existing id", async () => {
      store.get.mockRejectedValue(new NotFoundError("Not found"));

      await expect(repository.load("-9999")).rejects.toMatchObject({
        id: "services.storage.not_found",
      });
    });

    it("should let a store error through", async () => {
      store.get.mockRejectedValue(new InternalError("test"));

      await expect(repository.load("error")).rejects.toMatchObject({
        message: "test",
      });
    });

    it("should reject when the cache holds something that is not JSON", async () => {
      cache.get.mockResolvedValue("bad type");

      await expect(repository.load("string")).rejects.toMatchObject({
        id: "services.cache.read_failed",
      });
    });

    it("should return the cached object, and refresh its TTL, when there is one", async () => {
      cache.get.mockResolvedValue(JSON.stringify(cachePojo));

      const result = await repository.load("cached");

      expect(result).toBeInstanceOf(Persisted);
      expect(result).toMatchObject({ _id: "someId", some: "source" });
      expect(store.get).not.toHaveBeenCalled();
      expect(cache.expire).toHaveBeenCalled();
    });

    it("should fall back on the store, and populate the cache, when it is not cached", async () => {
      store.get.mockResolvedValue(dbPojo);

      const result = await repository.load("uncached");

      expect(result).toBeInstanceOf(Persisted);
      expect(result).toMatchObject({ _id: "someId", some: "source" });
      // What "fall back" costs, and the Mocha spec never asserted: the object
      // is written to the cache on the way out.
      expect(cache.store).toHaveBeenCalledOnce();
    });

    it("should get content only from the store if no cache is set", async () => {
      const loadFromCache = vi.spyOn(repository, "loadFromCache");
      repository.useCacheDb(cacheDbEnum.NONE);
      store.get.mockResolvedValue(dbPojo);

      const result = await repository.load("no-cache");

      expect(result).toMatchObject({ _id: "someId", some: "source" });
      expect(loadFromCache).not.toHaveBeenCalled();
    });

    it("should answer null when nothing is cached and there is no store", async () => {
      repository.dropStore();

      await expect(repository.load("uncached")).resolves.toBeNull();
    });
  });

  describe("#persistToDatabase", () => {
    it("should createOrReplace by default", async () => {
      const object = { _id: "someId", some: "source" };

      await repository.persistToDatabase(object);

      expect(store.createOrReplace).toHaveBeenCalledWith(
        "objects",
        "someId",
        { some: "source" },
        {},
      );
    });

    it("should create when asked to, passing the id as an option", async () => {
      const object = { _id: "someId", some: "source" };

      await repository.persistToDatabase(object, { method: "create" });

      expect(store.create).toHaveBeenCalledWith(
        "objects",
        { some: "source" },
        { method: "create", id: "someId" },
      );
    });
  });

  describe("#deleteFromDatabase", () => {
    it("should delete through the store", async () => {
      await repository.deleteFromDatabase("someId");

      expect(store.delete).toHaveBeenCalledWith("objects", "someId", {});
    });
  });

  describe("#deleteFromCache", () => {
    it("should delete the cache key", async () => {
      await repository.deleteFromCache("someId");

      expect(cache.del).toHaveBeenCalledWith(repository.getCacheKey("someId"));
    });
  });

  describe("#delete", () => {
    it("should delete an object from both cache and database", async () => {
      await repository.delete({ _id: "someId" });

      expect(cache.del).toHaveBeenCalledWith(repository.getCacheKey("someId"));
      expect(store.delete).toHaveBeenCalledWith("objects", "someId", {});
    });

    it("should refuse an object that has never been stored", async () => {
      await expect(
        repository.delete({ _id: invalid<string>(null) }),
      ).rejects.toMatchObject({
        id: "services.storage.missing_argument",
      });
    });
  });

  describe("#persistToCache", () => {
    it("should store the serialized object under the given key", async () => {
      await repository.persistToCache(cachePojo, {
        ttl: invalid<number>(false),
        key: "someKey",
      });

      expect(cache.store).toHaveBeenCalledWith(
        "someKey",
        JSON.stringify(cachePojo),
        { ttl: false },
      );
    });

    it("should pass the ttl it is given", async () => {
      await repository.persistToCache(cachePojo, { ttl: 500, key: "someKey" });

      expect(cache.store).toHaveBeenCalledWith(
        "someKey",
        JSON.stringify(cachePojo),
        { ttl: 500 },
      );
    });
  });

  describe("#refreshCacheTTL", () => {
    const key = () => repository.getCacheKey("someId");

    it("should persist the object when the ttl is not a positive number", async () => {
      await repository.refreshCacheTTL(cachePojo, {
        ttl: invalid<number>(false),
      });

      expect(cache.persist).toHaveBeenCalledWith(key());
    });

    it("should expire with the provided TTL", async () => {
      await repository.refreshCacheTTL(cachePojo, { ttl: 500 });

      expect(cache.expire).toHaveBeenCalledWith(key(), 500);
    });

    it("should use the object's own TTL when none is provided", async () => {
      await repository.refreshCacheTTL({ ...cachePojo, ttl: 1234 });

      expect(cache.expire).toHaveBeenCalledWith(key(), 1234);
    });

    it("should prefer the provided ttl over the object's", async () => {
      await repository.refreshCacheTTL(
        { ...cachePojo, ttl: 1234 },
        { ttl: 500 },
      );

      expect(cache.expire).toHaveBeenCalledWith(key(), 500);
    });
  });

  describe("#expireFromCache", () => {
    it("should expire the object immediately", async () => {
      await repository.expireFromCache(cachePojo);

      expect(cache.expire).toHaveBeenCalledWith(
        repository.getCacheKey("someId"),
        -1,
      );
    });
  });

  describe("#serializeToCache", () => {
    it("should return the object's own properties", () => {
      const object = Object.assign(new Persisted(), {
        _id: "someId",
        some: "source",
      });

      expect(repository.serializeToCache(object)).toEqual({
        _id: "someId",
        some: "source",
      });
    });
  });

  describe("#serializeToDatabase", () => {
    it("should remove the _id", () => {
      expect(repository.serializeToDatabase(cachePojo)).toEqual({
        some: "source",
      });
    });
  });

  describe("#search", () => {
    it("should return a list from the store", async () => {
      store.search.mockResolvedValue({ hits: [dbPojo], total: 1 });

      const response = await repository.search({ query: "noquery" });

      expect(response.hits).toHaveLength(1);
      expect(response.total).toBe(1);
      expect(store.search).toHaveBeenCalledWith(
        "objects",
        { query: "noquery" },
        {},
      );
    });

    it("should inject back the scroll id, if there is one", async () => {
      store.search.mockResolvedValue({
        hits: [dbPojo],
        scrollId: "foobar",
        total: 1,
      });

      const response = await repository.search(
        { query: "noquery" },
        { from: 13, scroll: "45s", size: 42 },
      );

      expect(response.total).toBe(1);
      expect(response.scrollId).toBe("foobar");
      expect(store.search).toHaveBeenCalledWith(
        "objects",
        { query: "noquery" },
        { from: 13, scroll: "45s", size: 42 },
      );
    });

    it("should return an empty list if there are no hits", async () => {
      store.search.mockResolvedValue({ hits: [], total: 0 });

      const response = await repository.search({});

      expect(response.hits).toEqual([]);
      expect(response.total).toBe(0);
    });

    it("should be rejected with an error if something goes wrong", async () => {
      const error = new Error("Mocked error");
      store.search.mockRejectedValue(error);

      await expect(repository.search({})).rejects.toBe(error);
    });
  });

  describe("#scroll", () => {
    it("should return a list from the store", async () => {
      store.scroll.mockResolvedValue({ hits: [dbPojo], total: 1 });

      const response = await repository.scroll("foo");

      expect(response.hits).toHaveLength(1);
      expect(response.total).toBe(1);
      expect(store.scroll).toHaveBeenCalledWith("foo", undefined);
    });

    it("should inject back the scroll id", async () => {
      store.scroll.mockResolvedValue({
        hits: [dbPojo],
        scrollId: "foobar",
        total: 1,
      });

      const response = await repository.scroll("foo", "bar");

      expect(response.total).toBe(1);
      expect(response.scrollId).toBe("foobar");
      expect(store.scroll).toHaveBeenCalledWith("foo", "bar");
    });

    it("should return an empty list if there are no hits", async () => {
      store.scroll.mockResolvedValue({
        hits: [],
        scrollId: "foobar",
        total: 0,
      });

      const response = await repository.scroll("foo");

      expect(response.hits).toEqual([]);
      expect(response.total).toBe(0);
      expect(response.scrollId).toBe("foobar");
    });

    it("should be rejected with an error if something goes wrong", async () => {
      const error = new Error("Mocked error");
      store.scroll.mockRejectedValue(error);

      await expect(repository.scroll("foo")).rejects.toBe(error);
    });
  });

  describe("#truncate", () => {
    it("should scroll and delete all objects except protected ones", async () => {
      repository.useCollection("profiles");
      repository.search = vi.fn(async () => ({
        total: 6,
        scrollId: "foobarRole",
        hits: [
          { _id: "admin" },
          { _id: "role1" },
          { _id: "role2" },
          { _id: "role3" },
        ],
      }));
      repository.scroll = vi
        .fn()
        .mockResolvedValueOnce({
          total: 1,
          scrollId: "foobarRole2",
          hits: [{ _id: "role4" }],
        })
        .mockResolvedValueOnce({
          total: 1,
          scrollId: "foobarRole2",
          hits: [{ _id: "role5" }],
        });
      repository.load = vi.fn(async (id: string) => ({ _id: id }));
      repository.delete = vi.fn(async () => undefined);

      const deleted = await repository.truncate({ refresh: "wait_for" });

      expect(repository.search).toHaveBeenCalledOnce();
      expect(repository.scroll).toHaveBeenCalledTimes(2);
      expect(repository.scroll).toHaveBeenNthCalledWith(1, "foobarRole", "5s");
      expect(repository.scroll).toHaveBeenNthCalledWith(2, "foobarRole2", "5s");

      // "admin" is protected on the `profiles` collection, and is the one of
      // the six that is not deleted.
      expect(repository.delete).toHaveBeenCalledTimes(5);
      expect(
        (
          repository.delete as unknown as {
            mock: { calls: [{ _id: string }, unknown][] };
          }
        ).mock.calls.map(([object]) => object._id),
      ).toEqual(["role1", "role2", "role3", "role4", "role5"]);
      expect(repository.delete).toHaveBeenNthCalledWith(
        1,
        { _id: "role1" },
        { refresh: "wait_for" },
      );
      expect(deleted).toBe(5);
    });
  });
});
