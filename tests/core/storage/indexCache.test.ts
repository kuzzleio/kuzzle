import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { IndexCache } from "../../../lib/core/storage/indexCache";
import { PreconditionError } from "../../../lib/kerror/errors/preconditionError";
import { ServiceUnavailableError } from "../../../lib/kerror/errors/serviceUnavailableError";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

describe("#core/storage/IndexCache", () => {
  let indexCache: IndexCache;

  beforeEach(() => {
    /*
     * The subject is a pure in-memory map. The Mocha spec built a whole
     * KuzzleMock and never used it — the only reason a fixture is needed at
     * all is that `kerror` reads `global.kuzzle` when it formats a message.
     */
    stubKuzzle();
    indexCache = new IndexCache();
  });

  afterEach(() => {
    restoreKuzzle();
  });

  describe("#addIndex", () => {
    it("adds an index that was not cached", () => {
      expect(indexCache.hasIndex("foo")).toBe(false);
      expect(indexCache.addIndex("foo")).toBe(true);
      expect(indexCache.hasIndex("foo")).toBe(true);
    });

    it("reports false for an index already cached", () => {
      expect(indexCache.addIndex("foo")).toBe(true);
      expect(indexCache.addIndex("foo")).toBe(false);
    });
  });

  describe("#addCollection", () => {
    it("adds a collection to an existing index", () => {
      indexCache.addIndex("foo");

      expect(indexCache.hasCollection("foo", "bar")).toBe(false);

      indexCache.addCollection("foo", "bar");

      expect(indexCache.hasCollection("foo", "bar")).toBe(true);
    });

    it("creates the index when it is not cached yet", () => {
      expect(indexCache.hasIndex("foo")).toBe(false);

      indexCache.addCollection("foo", "bar");

      expect(indexCache.hasIndex("foo")).toBe(true);
      expect(indexCache.hasCollection("foo", "bar")).toBe(true);
    });
  });

  describe("#removeIndex", () => {
    it("removes an index and its collections", () => {
      indexCache.addCollection("foo", "bar");

      indexCache.removeIndex("foo");

      expect(indexCache.hasIndex("foo")).toBe(false);
      /*
       * Not asserted by the Mocha spec, which checked the index only: removing
       * an index must take its collections with it, or a re-created index
       * would come back carrying them.
       */
      expect(indexCache.hasCollection("foo", "bar")).toBe(false);
    });

    it("ignores an index it does not know", () => {
      expect(() => indexCache.removeIndex("foo")).not.toThrow();
    });
  });

  describe("#removeCollection", () => {
    it("removes a collection and keeps its index", () => {
      indexCache.addCollection("foo", "bar");

      indexCache.removeCollection("foo", "bar");

      expect(indexCache.hasCollection("foo", "bar")).toBe(false);
      expect(indexCache.hasIndex("foo")).toBe(true);
    });

    it("ignores an unknown index or collection", () => {
      indexCache.addCollection("foo", "bar");

      indexCache.removeCollection("ohnoes", "bar");
      indexCache.removeCollection("foo", "ohnoes");

      expect(indexCache.hasCollection("foo", "bar")).toBe(true);
    });
  });

  describe("#listIndexes", () => {
    it("returns nothing on an empty cache", () => {
      expect(indexCache.listIndexes()).toEqual([]);
    });

    it("returns every cached index, however it was created", () => {
      indexCache.addIndex("foo");
      indexCache.addCollection("foo", "bar");
      indexCache.addCollection("qux", "baz");

      expect(indexCache.listIndexes()).toEqual(["foo", "qux"]);
    });
  });

  describe("#listCollections", () => {
    it("throws on an index it does not know", () => {
      expect(() => indexCache.listCollections("foo")).toThrow(
        expect.objectContaining({ id: "services.storage.unknown_index" }),
      );
    });

    it("returns nothing for an index with no collection", () => {
      indexCache.addIndex("foo");

      expect(indexCache.listCollections("foo")).toEqual([]);
    });

    it("returns only that index's collections", () => {
      indexCache.addCollection("foo", "bar");
      indexCache.addCollection("foo", "baz");
      indexCache.addCollection("qux", "qux");

      expect(indexCache.listCollections("foo")).toEqual(["bar", "baz"]);
    });
  });

  describe("#replaceIndexes", () => {
    const cached = () =>
      Object.fromEntries(
        indexCache
          .listIndexes()
          .map((index) => [index, indexCache.listCollections(index).sort()]),
      );

    /* kuzzle#3040: a peer deleted them before this node joined the cluster,
     * so their deletion broadcast never reached it. */
    it("drops the indexes and collections storage no longer holds", () => {
      indexCache.addCollection("kept", "a");
      indexCache.addCollection("kept", "deleted");
      indexCache.addCollection("deleted", "a");
      const snapshot = indexCache.snapshotIndexes();

      indexCache.replaceIndexes({ added: ["b"], kept: ["a"] }, snapshot);

      expect(cached()).toEqual({ added: ["b"], kept: ["a"] });
    });

    it("keeps an index without collections", () => {
      indexCache.replaceIndexes({ empty: [] }, indexCache.snapshotIndexes());

      expect(cached()).toEqual({ empty: [] });
    });

    /* A change that landed while storage was read is newer than the read:
     * the reload must neither bring back a deletion nor drop a creation. */
    it("keeps what changed since the snapshot", () => {
      indexCache.addCollection("idx", "removed");
      indexCache.addCollection("removedIndex", "a");
      indexCache.addCollection("recreated", "old");
      const snapshot = indexCache.snapshotIndexes();

      indexCache.addCollection("idx", "added");
      indexCache.removeCollection("idx", "removed");
      indexCache.addIndex("addedIndex");
      indexCache.addCollection("addedCollectionIndex", "c");
      indexCache.removeIndex("removedIndex");
      indexCache.removeIndex("recreated");
      indexCache.addCollection("recreated", "new");
      indexCache.replaceIndexes(
        {
          idx: ["removed"],
          recreated: ["old"],
          removedIndex: ["a"],
        },
        snapshot,
      );

      expect(cached()).toEqual({
        addedCollectionIndex: ["c"],
        addedIndex: [],
        idx: ["added"],
        recreated: ["new"],
      });
    });
  });

  describe("#assertions", () => {
    it("asserts an index exists", () => {
      indexCache.addIndex("foo");

      expect(() => indexCache.assertIndexExists("foo")).not.toThrow();
      expect(() => indexCache.assertIndexExists("bar")).toThrow(
        expect.objectContaining({ id: "services.storage.unknown_index" }),
      );
    });

    it("asserts a collection exists, and names which half is missing", () => {
      indexCache.addCollection("foo", "bar");

      expect(() =>
        indexCache.assertCollectionExists("foo", "bar"),
      ).not.toThrow();
      expect(() => indexCache.assertCollectionExists("foo", "baz")).toThrow(
        expect.objectContaining({ id: "services.storage.unknown_collection" }),
      );
      expect(() => indexCache.assertCollectionExists("fooz", "bar")).toThrow(
        expect.objectContaining({ id: "services.storage.unknown_index" }),
      );
    });

    /* Both assertions raise the same class; only the id distinguishes them. */
    it("raises a PreconditionError", () => {
      expect(() => indexCache.assertIndexExists("bar")).toThrow(
        PreconditionError,
      );
    });
  });

  describe("collection write locks", () => {
    const lock = { lockedAt: 42, owner: "mapping-migration", reason: "job-1" };

    it("caches, answers and removes a lock", () => {
      expect(indexCache.getLock("foo", "bar")).toBeNull();

      indexCache.setLock("foo", "bar", lock);

      expect(indexCache.getLock("foo", "bar")).toBe(lock);
      expect(indexCache.getLock("foo", "baz")).toBeNull();

      indexCache.removeLock("foo", "bar");
      indexCache.removeLock("foo", "bar");
      indexCache.removeLock("fooz", "bar");

      expect(indexCache.getLock("foo", "bar")).toBeNull();
    });

    it("replaces the lock a collection already holds", () => {
      const refreshed = { ...lock, lockedAt: 43 };

      indexCache.setLock("foo", "bar", lock);
      indexCache.setLock("foo", "bar", refreshed);

      expect(indexCache.getLock("foo", "bar")).toBe(refreshed);
    });

    describe("#replaceLocks", () => {
      const stored = (...entries: [string, string, typeof lock][]) => {
        const locks = new Map<string, Map<string, typeof lock>>();

        for (const [index, collection, value] of entries) {
          locks.set(
            index,
            (locks.get(index) ?? new Map()).set(collection, value),
          );
        }

        return locks;
      };

      it("replaces the cached locks with the stored ones", () => {
        indexCache.setLock("foo", "bar", lock);
        indexCache.setLock("fooz", "baz", lock);
        const snapshot = indexCache.snapshotLocks();

        indexCache.replaceLocks(stored(["foo", "qux", lock]), snapshot);

        expect(indexCache.getLock("foo", "bar")).toBeNull();
        expect(indexCache.getLock("fooz", "baz")).toBeNull();
        expect(indexCache.getLock("foo", "qux")).toBe(lock);
      });

      /* kuzzle#3040: a lock taken, refreshed or released while the stored
       * locks were read is newer than the read. */
      it("keeps the locks that changed since the snapshot", () => {
        const refreshed = { ...lock, lockedAt: 43 };
        indexCache.setLock("foo", "refreshed", lock);
        indexCache.setLock("foo", "released", lock);
        const snapshot = indexCache.snapshotLocks();

        indexCache.setLock("foo", "taken", lock);
        indexCache.setLock("foo", "refreshed", refreshed);
        indexCache.removeLock("foo", "released");
        indexCache.replaceLocks(
          stored(["foo", "refreshed", lock], ["foo", "released", lock]),
          snapshot,
        );

        expect(indexCache.getLock("foo", "taken")).toBe(lock);
        expect(indexCache.getLock("foo", "refreshed")).toBe(refreshed);
        expect(indexCache.getLock("foo", "released")).toBeNull();
      });
    });

    /* Locks are independent from the index cache: a lock check never asserts
     * the collection exists, the handlers do that first. */
    it("rejects writes to a locked collection only", () => {
      indexCache.setLock("foo", "bar", lock);

      expect(() =>
        indexCache.assertCollectionWritable("foo", "baz"),
      ).not.toThrow();
      expect(() =>
        indexCache.assertCollectionWritable("fooz", "bar"),
      ).not.toThrow();
      expect(() => indexCache.assertCollectionWritable("foo", "bar")).toThrow(
        expect.objectContaining({
          id: "services.storage.collection_locked",
          message:
            'The collection "foo":"bar" is locked by "mapping-migration" (job-1): write actions are rejected until it is unlocked.',
        }),
      );
      expect(() => indexCache.assertCollectionWritable("foo", "bar")).toThrow(
        ServiceUnavailableError,
      );
    });

    it("rejects index-wide writes when one of its collections is locked", () => {
      indexCache.setLock("foo", "bar", lock);

      expect(() => indexCache.assertIndexWritable("fooz")).not.toThrow();
      expect(() => indexCache.assertIndexWritable("foo")).toThrow(
        expect.objectContaining({ id: "services.storage.collection_locked" }),
      );

      indexCache.removeLock("foo", "bar");

      expect(() => indexCache.assertIndexWritable("foo")).not.toThrow();
    });
  });
});
