/* The storage driver contract (ADR-0003). Its methods are the ones the
 * storage layer calls, so the built-in Elasticsearch 7 and 8 drivers satisfy
 * it with every optional member. This file does not compile when the
 * contract drifts from them (`npm run typecheck:tests`). */

import { describe, expect, it } from "vitest";

import type { Client as ClientES7 } from "sdk-es7";
import type { Client as ClientES8 } from "sdk-es8";

import type {
  ES7Driver,
  ES8Driver,
} from "../../../lib/service/storage/builtInDrivers";
import type { StorageEngineElasticsearch } from "../../../lib/types/config/storageEngine/StorageEngineElasticsearchConfiguration";
import {
  STORAGE_CAPABILITIES,
  type StorageDriver,
  type StorageDriverClass,
  type StorageDriverCore,
} from "../../../lib/types/storage/StorageDriver";

type BuiltIn = StorageDriver &
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
  it("is fully implemented by the built-in Elasticsearch 7 and 8 drivers", () => {
    const fromEs7 = (driver: ES7Driver): BuiltIn => driver;
    const fromEs8 = (driver: ES8Driver): BuiltIn => driver;
    const es7Class = (
      Driver: typeof ES7Driver,
    ): StorageDriverClass<ClientES7, StorageEngineElasticsearch> => Driver;
    const es8Class = (
      Driver: typeof ES8Driver,
    ): StorageDriverClass<ClientES8, StorageEngineElasticsearch> => Driver;

    expect([fromEs7, fromEs8, es7Class, es8Class]).toHaveLength(4);
  });

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
