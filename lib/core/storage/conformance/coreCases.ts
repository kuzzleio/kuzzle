/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2026 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// The cases of the mandatory core: every driver passes them. They check what
// Kuzzle relies on, through the answers its storage layer reads.

import assert from "node:assert/strict";

import { field, hasField, rejectsWith } from "./conformanceContext";
import type { ConformanceContext } from "./conformanceContext";
import type { ConformanceTestApi } from "./storageDriverConformance";

const WAIT = { refresh: "wait_for" } as const;

/** The `_id`s of search hits or documents, sorted */
function ids(documents: { _id?: unknown }[]): string[] {
  return documents.map(({ _id }) => String(_id)).sort();
}

export function coreCases(
  test: ConformanceTestApi,
  context: ConformanceContext,
): void {
  test.describe("core: engine", () => {
    test.it("answers its engine type and version", async () => {
      const info = await context.driver.info();

      assert.equal(typeof info.type, "string");
      assert.ok(info.type.length > 0);
      assert.equal(typeof info.version, "string");
    });

    test.it(
      "translates Koncorde filters, or names the keyword it cannot",
      async () => {
        assert.equal(
          typeof context.driver.translateKoncordeFilters({
            equals: { city: "Montpellier" },
          }),
          "object",
        );

        // The Elasticsearch drivers cannot translate `bool`. Whatever a driver
        // cannot translate, it says so the way Kuzzle reads it (`KeywordError`).
        try {
          context.driver.translateKoncordeFilters({
            bool: { must: [{ equals: { city: "Lyon" } }] },
          });
        } catch (error) {
          assert.deepEqual(field(error, "keyword"), {
            name: "bool",
            type: "operator",
          });
        }
      },
    );
  });

  test.describe("core: indexes and collections", () => {
    test.it("lists its index, without the other scope's", async () => {
      const privateIndex = context.uniqueName(`${context.index}-private`);

      await context.privateDriver.createIndex(privateIndex);

      try {
        const schema = await context.driver.getSchema();
        const privateSchema = await context.privateDriver.getSchema();

        assert.ok(Object.hasOwn(schema, context.index));
        assert.ok(!Object.hasOwn(schema, privateIndex));
        assert.ok(Object.hasOwn(privateSchema, privateIndex));
        assert.ok(!Object.hasOwn(privateSchema, context.index));
      } finally {
        await context.privateDriver.deleteIndex(privateIndex);
      }
    });

    test.it("rejects an index that already exists", async () => {
      await rejectsWith(
        context.driver.createIndex(context.index),
        "services.storage.index_already_exists",
      );
    });

    test.it("creates a collection with its mappings and settings", async () => {
      const collection = await context.collection("collection");

      const schema = await context.driver.getSchema();
      assert.ok(schema[context.index]?.includes(collection));

      const mapping = await context.driver.getMapping(
        context.index,
        collection,
      );
      assert.deepEqual(field(mapping, "properties.city"), { type: "keyword" });
      assert.deepEqual(field(mapping, "properties.age"), { type: "integer" });
      assert.ok(!hasField(mapping, "properties._kuzzle_info"));

      const withMeta = await context.driver.getMapping(
        context.index,
        collection,
        { includeKuzzleMeta: true },
      );
      assert.ok(hasField(withMeta, "properties._kuzzle_info"));

      assert.equal(
        typeof (await context.driver.getSettings(context.index, collection)),
        "object",
      );
    });

    test.it("truncates, then deletes a collection", async () => {
      const collection = await context.collection("truncated");

      await context.driver.create(context.index, collection, { a: 1 }, WAIT);
      await context.driver.truncateCollection(context.index, collection);
      await context.driver.refreshCollection(context.index, collection);
      assert.equal(await context.driver.count(context.index, collection), 0);

      await context.driver.deleteCollection(context.index, collection);
      const schema = await context.driver.getSchema();
      assert.ok(!schema[context.index]?.includes(collection));
    });

    test.it("deletes indexes, answering the ones it deleted", async () => {
      const index = context.uniqueName(`${context.index}-deleted`);

      await context.driver.createIndex(index);

      assert.deepEqual(await context.driver.deleteIndexes([index]), [index]);
      assert.ok(!Object.hasOwn(await context.driver.getSchema(), index));
    });
  });

  test.describe("core: documents", () => {
    let collection: string;

    test.beforeAll(async () => {
      collection = await context.collection("documents");
    });

    test.it("creates a document, with or without an id", async () => {
      const created = await context.driver.create(
        context.index,
        collection,
        { city: "Montpellier", name: "alyx" },
        { id: "alyx", userId: "author-kuid" },
      );
      assert.equal(created._id, "alyx");

      const generated = await context.driver.create(context.index, collection, {
        name: "anonymous",
      });
      assert.equal(typeof generated._id, "string");
      assert.ok(generated._id.length > 0);

      const { _source } = await context.driver.get(
        context.index,
        collection,
        "alyx",
      );
      assert.equal(field(_source, "city"), "Montpellier");
      assert.equal(field(_source, "_kuzzle_info.author"), "author-kuid");
    });

    test.it("rejects a document id that already exists", async () => {
      await context.driver.create(context.index, collection, {}, { id: "dup" });

      await rejectsWith(
        context.driver.create(context.index, collection, {}, { id: "dup" }),
        "services.storage.document_already_exists",
      );
    });

    test.it(
      "rejects reading, changing or deleting a missing document",
      async () => {
        const missing = "missing-document";

        await rejectsWith(
          context.driver.get(context.index, collection, missing),
          "services.storage.not_found",
        );
        // The built-in drivers answer `services.storage.unexpected_not_found`
        // here: any 404 will do.
        await rejectsWith(
          context.driver.update(context.index, collection, missing, { a: 1 }),
          404,
        );
        await rejectsWith(
          context.driver.replace(context.index, collection, missing, { a: 1 }),
          "services.storage.not_found",
        );
        await rejectsWith(
          context.driver.delete(context.index, collection, missing),
          "services.storage.not_found",
        );
      },
    );

    test.it("tells which documents exist", async () => {
      await context.driver.create(context.index, collection, {}, { id: "e1" });

      assert.equal(
        await context.driver.exists(context.index, collection, "e1"),
        true,
      );
      assert.equal(
        await context.driver.exists(context.index, collection, "nope"),
        false,
      );
      assert.deepEqual(
        await context.driver.mExists(context.index, collection, ["e1", "nope"]),
        { errors: ["nope"], items: ["e1"] },
      );
    });

    test.it("gets several documents, listing the missing ones", async () => {
      await context.driver.create(
        context.index,
        collection,
        { n: 1 },
        {
          id: "g1",
        },
      );

      const { errors, items } = await context.driver.mGet(
        context.index,
        collection,
        ["g1", "nope"],
      );

      assert.deepEqual(ids(items), ["g1"]);
      assert.deepEqual(field(items[0]?._source, "n"), 1);
      assert.deepEqual(errors, ["nope"]);
    });

    test.it("creates or replaces, telling which one it did", async () => {
      const first = await context.driver.createOrReplace(
        context.index,
        collection,
        "cor",
        { v: 1 },
      );
      const second = await context.driver.createOrReplace(
        context.index,
        collection,
        "cor",
        { v: 2 },
      );

      assert.equal(first.created, true);
      assert.equal(second.created, false);
      const { _source } = await context.driver.get(
        context.index,
        collection,
        "cor",
      );
      assert.equal(field(_source, "v"), 2);
    });

    test.it(
      "updates, replaces, then deletes fields of a document",
      async () => {
        await context.driver.create(
          context.index,
          collection,
          { a: 1, b: 2 },
          { id: "upd" },
        );

        await context.driver.update(
          context.index,
          collection,
          "upd",
          { c: 3 },
          {
            userId: "updater-kuid",
          },
        );
        let { _source } = await context.driver.get(
          context.index,
          collection,
          "upd",
        );
        assert.equal(field(_source, "a"), 1);
        assert.equal(field(_source, "c"), 3);
        assert.equal(field(_source, "_kuzzle_info.updater"), "updater-kuid");

        await context.driver.replace(context.index, collection, "upd", {
          d: 4,
        });
        ({ _source } = await context.driver.get(
          context.index,
          collection,
          "upd",
        ));
        assert.ok(!hasField(_source, "a"));
        assert.equal(field(_source, "d"), 4);

        await context.driver.update(context.index, collection, "upd", { e: 5 });
        await context.driver.deleteFields(context.index, collection, "upd", [
          "e",
        ]);
        ({ _source } = await context.driver.get(
          context.index,
          collection,
          "upd",
        ));
        assert.ok(!hasField(_source, "e"));
        assert.equal(field(_source, "d"), 4);
      },
    );

    test.it(
      "upserts, applying the default values on creation only",
      async () => {
        const created = await context.driver.upsert(
          context.index,
          collection,
          "ups",
          { a: 1 },
          { defaultValues: { b: 2 } },
        );
        const updated = await context.driver.upsert(
          context.index,
          collection,
          "ups",
          { a: 3 },
          { defaultValues: { b: 4 } },
        );

        assert.equal(created.created, true);
        assert.equal(updated.created, false);
        const { _source } = await context.driver.get(
          context.index,
          collection,
          "ups",
        );
        assert.equal(field(_source, "a"), 3);
        assert.equal(field(_source, "b"), 2);
      },
    );

    test.it("deletes a document", async () => {
      await context.driver.create(context.index, collection, {}, { id: "del" });
      await context.driver.delete(context.index, collection, "del");

      assert.equal(
        await context.driver.exists(context.index, collection, "del"),
        false,
      );
    });
  });

  test.describe("core: several documents at once", () => {
    let collection: string;

    test.beforeAll(async () => {
      collection = await context.collection("many");
    });

    test.it(
      "creates several documents, reporting the ones it could not",
      async () => {
        await context.driver.create(
          context.index,
          collection,
          {},
          { id: "m0" },
        );

        const { errors, items } = await context.driver.mCreate(
          context.index,
          collection,
          [
            { _id: "m0", body: { n: 0 } },
            { _id: "m1", body: { n: 1 } },
            { _id: "m2", body: { n: 2 } },
          ],
          WAIT,
        );

        assert.deepEqual(ids(items), ["m1", "m2"]);
        assert.equal(errors.length, 1);
      },
    );

    test.it(
      "creates or replaces, updates, upserts and replaces several documents",
      async () => {
        let result = await context.driver.mCreateOrReplace(
          context.index,
          collection,
          [
            { _id: "m1", body: { n: 10 } },
            { _id: "m3", body: { n: 3 } },
          ],
        );
        assert.deepEqual(ids(result.items), ["m1", "m3"]);

        result = await context.driver.mUpdate(context.index, collection, [
          { _id: "m1", body: { updated: true } },
          { _id: "nope", body: { updated: true } },
        ]);
        assert.deepEqual(ids(result.items), ["m1"]);
        assert.equal(result.errors.length, 1);

        result = await context.driver.mUpsert(context.index, collection, [
          { _id: "m2", changes: { upserted: true } },
          { _id: "m4", changes: { upserted: true } },
        ]);
        assert.deepEqual(ids(result.items), ["m2", "m4"]);

        result = await context.driver.mReplace(context.index, collection, [
          { _id: "m3", body: { replaced: true } },
          { _id: "nope", body: { replaced: true } },
        ]);
        assert.deepEqual(ids(result.items), ["m3"]);
        assert.equal(result.errors.length, 1);

        const { items } = await context.driver.mGet(context.index, collection, [
          "m1",
          "m2",
          "m3",
          "m4",
        ]);
        const sources = Object.fromEntries(
          items.map(({ _id, _source }) => [_id, _source]),
        );
        assert.equal(field(sources.m1, "n"), 10);
        assert.equal(field(sources.m1, "updated"), true);
        assert.equal(field(sources.m2, "upserted"), true);
        assert.equal(field(sources.m3, "replaced"), true);
        assert.ok(!hasField(sources.m3, "n"));
        assert.equal(field(sources.m4, "upserted"), true);
      },
    );

    test.it(
      "deletes several documents, reporting the missing ones",
      async () => {
        await context.driver.mCreateOrReplace(context.index, collection, [
          { _id: "d1", body: {} },
          { _id: "d2", body: {} },
        ]);

        const { documents, errors } = await context.driver.mDelete(
          context.index,
          collection,
          ["d1", "d2", "nope"],
        );

        assert.deepEqual(ids(documents), ["d1", "d2"]);
        assert.equal(errors.length, 1);
      },
    );

    test.it("imports documents in the bulk format", async () => {
      const imported = context.uniqueName("imported");
      await context.driver.createCollection(context.index, imported);

      const { errors, items } = await context.driver.import(
        context.index,
        imported,
        [
          { index: { _id: "i1" } },
          { n: 1 },
          { create: { _id: "i2" } },
          { n: 2 },
        ],
        WAIT,
      );

      assert.deepEqual(errors, []);
      assert.equal(items.length, 2);
      assert.equal(await context.driver.count(context.index, imported), 2);
    });
  });

  test.describe("core: search", () => {
    let collection: string;
    let other: string;

    test.beforeAll(async () => {
      collection = await context.collection("search");
      other = await context.collection("search-other");

      await context.driver.mCreate(
        context.index,
        collection,
        [
          { _id: "s1", body: { age: 30, city: "Montpellier", name: "a" } },
          { _id: "s2", body: { age: 40, city: "Montpellier", name: "b" } },
          { _id: "s3", body: { age: 50, city: "Lyon", name: "c" } },
          { _id: "s4", body: { age: 60, city: "Paris", name: "d" } },
        ],
        WAIT,
      );
      await context.driver.create(
        context.index,
        other,
        { city: "Montpellier" },
        { id: "o1", ...WAIT },
      );
    });

    test.it("counts the documents matching a query", async () => {
      assert.equal(await context.driver.count(context.index, collection), 4);
      assert.equal(
        await context.driver.count(context.index, collection, {
          query: { term: { city: "Montpellier" } },
        }),
        2,
      );
    });

    test.it("searches with a query, sort, from and size", async () => {
      const { hits, total } = await context.driver.search(
        {
          collection,
          index: context.index,
          searchBody: {
            query: { range: { age: { gte: 40 } } },
            sort: [{ age: "asc" }],
          },
        },
        { from: 1, size: 1 },
      );

      assert.equal(total, 3);
      assert.deepEqual(
        hits.map(({ _id }) => _id),
        ["s3"],
      );
    });

    test.it("searches with translated Koncorde filters", async () => {
      const query = context.driver.translateKoncordeFilters({
        equals: { city: "Lyon" },
      });
      const { hits } = await context.driver.search({
        collection,
        index: context.index,
        searchBody: { query },
      });

      assert.deepEqual(ids(hits), ["s3"]);
    });

    test.it(
      "searches several collections, telling where each hit is",
      async () => {
        const { hits } = await context.driver.search({
          searchBody: { query: { term: { city: "Montpellier" } } },
          targets: [{ collections: [collection, other], index: context.index }],
        });

        assert.deepEqual(ids(hits), ["o1", "s1", "s2"]);
        for (const hit of hits) {
          assert.equal(hit.index, context.index);
          assert.equal(hit.collection, hit._id === "o1" ? other : collection);
        }
      },
    );

    test.it("scrolls through the results, page by page", async () => {
      const first = await context.driver.search(
        {
          collection,
          index: context.index,
          searchBody: { sort: [{ age: "asc" }] },
        },
        { scroll: "10s", size: 3 },
      );

      assert.equal(first.total, 4);
      assert.equal(first.hits.length, 3);
      assert.equal(typeof first.scrollId, "string");

      const second = await context.driver.scroll(String(first.scrollId), {
        scrollTTL: "10s",
      });

      assert.deepEqual(
        [...first.hits, ...second.hits].map(({ _id }) => _id),
        ["s1", "s2", "s3", "s4"],
      );
      assert.equal(second.remaining, 0);
    });

    test.it(
      "runs a callback on every page of documents matching a query",
      async () => {
        const pages = await context.driver.mExecute(
          context.index,
          collection,
          { match_all: {} },
          (documents) => documents.map(({ _id }) => _id),
          { size: 3 },
        );

        assert.deepEqual(pages.flat().map(String).sort(), [
          "s1",
          "s2",
          "s3",
          "s4",
        ]);
      },
    );

    test.it(
      "deletes the documents matching a query, answering them",
      async () => {
        const deleted = context.uniqueName("deleted");
        await context.driver.createCollection(context.index, deleted, {
          mappings: { properties: { city: { type: "keyword" } } },
        });
        await context.driver.mCreate(
          context.index,
          deleted,
          [
            { _id: "x1", body: { city: "Lyon" } },
            { _id: "x2", body: { city: "Paris" } },
          ],
          WAIT,
        );

        const { documents } = await context.driver.deleteByQuery(
          context.index,
          deleted,
          { term: { city: "Lyon" } },
          WAIT,
        );

        assert.deepEqual(ids(documents), ["x1"]);
        assert.equal(await context.driver.count(context.index, deleted), 1);
      },
    );
  });

  test.describe("core: engine hooks", () => {
    test.it(
      "waits for a new collection's shards, when the driver can",
      async () => {
        if (!context.driver.waitForCollectionShards) {
          return;
        }

        const collection = await context.collection("shards");
        await context.driver.waitForCollectionShards(
          context.index,
          collection,
          "10s",
        );
      },
    );
  });
}
