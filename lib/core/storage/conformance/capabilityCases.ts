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

// The cases of the optional capability groups: a group's cases are registered
// only when the driver declares it. The test runners list a suite before any
// hook runs, so the capabilities are read at registration time.

import assert from "node:assert/strict";

import { field } from "./conformanceContext";
import type { ConformanceContext } from "./conformanceContext";
import type { ConformanceTestApi } from "./storageDriverConformance";
import { STORAGE_CAPABILITIES } from "../../../types/storage/StorageDriver";
import type { StorageCapability } from "../../../types/storage/StorageDriver";

const WAIT = { refresh: "wait_for" } as const;

const IMPLEMENTED =
  "a driver declaring a capability implements its methods (Kuzzle checks it when it loads the driver)";

const CASES: Record<
  StorageCapability,
  (test: ConformanceTestApi, context: ConformanceContext) => void
> = {
  aggregations(test, context) {
    test.it("answers the aggregations of a search", async () => {
      const collection = await context.collection("aggregations");
      await context.driver.mCreate(
        context.index,
        collection,
        [
          { _id: "a1", body: { city: "Lyon" } },
          { _id: "a2", body: { city: "Lyon" } },
          { _id: "a3", body: { city: "Paris" } },
        ],
        WAIT,
      );

      const { aggregations } = await context.driver.search({
        collection,
        index: context.index,
        searchBody: { aggregations: { cities: { terms: { field: "city" } } } },
      });

      assert.deepEqual(field(aggregations, "cities.buckets"), [
        { doc_count: 2, key: "Lyon" },
        { doc_count: 1, key: "Paris" },
      ]);
    });
  },

  mappingUpdates(test, context) {
    test.it("adds fields to the mappings of a collection", async () => {
      const collection = await context.collection("mappings");

      const { driver } = context;
      assert.ok(driver.updateMapping && driver.updateCollection, IMPLEMENTED);

      await driver.updateMapping(context.index, collection, {
        properties: { country: { type: "keyword" } },
      });
      await driver.updateCollection(context.index, collection, {
        mappings: { properties: { zip: { type: "keyword" } } },
      });

      const mapping = await context.driver.getMapping(
        context.index,
        collection,
      );
      assert.deepEqual(field(mapping, "properties.country"), {
        type: "keyword",
      });
      assert.deepEqual(field(mapping, "properties.zip"), { type: "keyword" });
      assert.deepEqual(field(mapping, "properties.city"), { type: "keyword" });
    });
  },

  stats(test, context) {
    test.it("answers the document count of each collection", async () => {
      const collection = await context.collection("stats");
      await context.driver.mCreate(
        context.index,
        collection,
        [{ body: {} }, { body: {} }],
        WAIT,
      );

      const { driver } = context;
      assert.ok(driver.stats, IMPLEMENTED);

      const { indexes } = await driver.stats();
      const index = indexes.find(({ name }) => name === context.index);

      assert.ok(index, `the stats list the index "${context.index}"`);
      assert.equal(
        index.collections.find(({ name }) => name === collection)
          ?.documentCount,
        2,
      );
    });
  },

  updateByQuery(test, context) {
    test.it("updates the documents matching a query", async () => {
      const collection = await context.collection("update-by-query");
      await context.driver.mCreate(
        context.index,
        collection,
        [
          { _id: "u1", body: { city: "Lyon" } },
          { _id: "u2", body: { city: "Lyon" } },
          { _id: "u3", body: { city: "Paris" } },
        ],
        WAIT,
      );

      const { driver } = context;
      assert.ok(driver.updateByQuery && driver.bulkUpdateByQuery, IMPLEMENTED);

      const { errors, successes } = await driver.updateByQuery(
        context.index,
        collection,
        { term: { city: "Lyon" } },
        { name: "updated" },
        WAIT,
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(
        successes
          .map(({ _id }) => String(_id))
          .sort((a, b) => a.localeCompare(b)),
        ["u1", "u2"],
      );

      const { updated } = await driver.bulkUpdateByQuery(
        context.index,
        collection,
        { term: { city: "Paris" } },
        { name: "bulk-updated" },
        { refresh: true },
      );
      assert.equal(updated, 1);

      const { items } = await context.driver.mGet(context.index, collection, [
        "u1",
        "u3",
      ]);
      assert.deepEqual(
        items.map(({ _source }) => field(_source, "name")),
        ["updated", "bulk-updated"],
      );
    });
  },
};

export function capabilityCases(
  test: ConformanceTestApi,
  context: ConformanceContext,
): void {
  for (const capability of STORAGE_CAPABILITIES) {
    if (context.capabilities.has(capability)) {
      test.describe(`capability: ${capability}`, () => {
        CASES[capability](test, context);
      });
    }
  }
}
