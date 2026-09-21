import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { IndexCache } from "../../../lib/core/storage/indexCache";
import { PreconditionError } from "../../../lib/kerror/errors/preconditionError";
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
});
