/* The storage driver contract (ADR-0003 step 01). Its methods are the ones the
 * storage layer calls today, so the built-in Elasticsearch 7 and 8 classes
 * must satisfy it as they are: step 02 wraps them in thin drivers, which only
 * add the two members below. This file does not compile when the contract
 * drifts from them (`npm run typecheck:tests`). */

import { describe, expect, it } from "vitest";

import type { ES7 } from "../../../lib/service/storage/7/elasticsearch";
import type { ES8 } from "../../../lib/service/storage/8/elasticsearch";
import {
  STORAGE_CAPABILITIES,
  type StorageDriver,
  type StorageDriverClass,
  type StorageDriverCore,
} from "../../../lib/types/storage/StorageDriver";

/** What a thin driver adds around a built-in class */
type Wrapped = "getNativeClient" | "init";

type BuiltIn = Omit<StorageDriver, Wrapped> &
  Required<
    Pick<
      StorageDriver,
      | "bulkUpdateByQuery"
      | "generateMissingAliases"
      | "stats"
      | "updateByQuery"
      | "updateCollection"
      | "updateMapping"
      | "waitForCollectionShards"
    >
  >;

describe("StorageDriver contract", () => {
  it("is satisfied by the built-in Elasticsearch 7 and 8 classes", () => {
    const fromEs7 = (es: ES7): BuiltIn => es;
    const fromEs8 = (es: ES8): BuiltIn => es;

    expect([fromEs7, fromEs8]).toHaveLength(2);
  });

  it("is implementable with the core only", () => {
    // A driver declaring no capability and having no engine hook.
    const coreOnly = (driver: StorageDriverCore): StorageDriver => driver;
    const asClass = (
      Driver: new (
        ...args: ConstructorParameters<StorageDriverClass>
      ) => StorageDriverCore,
    ): StorageDriverClass => Driver;

    expect([coreOnly, asClass]).toHaveLength(2);
  });

  it("lists every optional capability group", () => {
    expect(STORAGE_CAPABILITIES).toEqual([
      "aggregations",
      "mappingUpdates",
      "stats",
      "updateByQuery",
    ]);
  });
});
