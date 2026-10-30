/* The storage driver contract (ADR-0003). Its methods are the ones the
 * storage layer calls. The Elasticsearch drivers check that they implement
 * it in their own repositories, against the `kuzzle` they depend on. */

import { describe, expect, it } from "vitest";

import {
  STORAGE_CAPABILITIES,
  type StorageDriver,
  type StorageDriverClass,
  type StorageDriverCore,
} from "../../../lib/types/storage/StorageDriver";

describe("StorageDriver contract", () => {
  it("is implementable with the core only", () => {
    // A driver declaring no capability and having no engine hook.
    const coreOnly = (driver: StorageDriverCore): StorageDriver => driver;
    const asClass = (
      Driver: (new (
        ...args: ConstructorParameters<StorageDriverClass>
      ) => StorageDriverCore) &
        Pick<StorageDriverClass, "createNativeClient">,
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
