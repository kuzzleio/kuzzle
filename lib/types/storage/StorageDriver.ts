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

// The storage driver contract (ADR-0003 step 01): what a package selected by
// `services.storageEngine.driver` implements. A mandatory core, plus optional
// capability groups a driver declares in its manifest.
//
// The methods are the ones the storage layer (`ClientAdapter`) calls today,
// with the same arguments and answers: the built-in Elasticsearch 7 and 8
// classes satisfy it as they are (tests/core/storage/storageDriver.test.ts).
// Query, search body and mappings arguments are Elasticsearch DSL, the public
// API's query language.

import type { storeScopeEnum } from "../../core/storage/storeScopeEnum";
import type { JSONObject } from "../JSONObject";
import type { ValidatedTarget } from "../Target";

/**
 * The optional capability groups. A driver declares the ones it implements in
 * its manifest; a request needing one it did not declare is rejected.
 *
 * - `aggregations`: `aggregations` / `aggs` in a search body
 * - `mappingUpdates`: changing the mappings of an existing collection
 *   (`updateMapping`, `updateCollection`)
 * - `stats`: storage statistics (`stats`)
 * - `updateByQuery`: updating every document matching a query
 *   (`updateByQuery`, `bulkUpdateByQuery`)
 */
export const STORAGE_CAPABILITIES = [
  "aggregations",
  "mappingUpdates",
  "stats",
  "updateByQuery",
] as const;

export type StorageCapability = (typeof STORAGE_CAPABILITIES)[number];

/**
 * A driver's `manifest.json`, at its package root, read before its code is
 * loaded.
 */
export type StorageDriverManifest = {
  /**
   * Semver range of the Kuzzle versions the driver is compatible with: the
   * only versioning of this contract.
   * @example ">=2.61.0 <3"
   */
  kuzzleVersion: string;
  /** The optional capability groups the driver implements */
  capabilities: StorageCapability[];
};

export type StorageRefresh = boolean | "wait_for";

/** Options shared by the actions writing a document */
export type StorageWriteOptions = {
  refresh?: StorageRefresh;
  /** Kuid written to `_kuzzle_info`, `null` for an anonymous write */
  userId?: string | null;
  /** Whether to write `_kuzzle_info` at all */
  injectKuzzleMeta?: boolean;
};

/** Options shared by the actions writing several documents */
export type StorageMWriteOptions = StorageWriteOptions & {
  timeout?: string;
};

/**
 * `_source` is typed as loosely as the Elasticsearch SDK types it, and left
 * out by the engine on some writes.
 */
export type StorageDocument = {
  _id: string;
  _source?: unknown;
  _version?: number;
};

/** The answer of every `m*` write */
export type StorageMResult = {
  errors: JSONObject[];
  items: JSONObject[];
};

/**
 * Typed as loosely as the Elasticsearch SDK types a hit: `_id` and `_source`
 * are always set in practice.
 */
export type StorageSearchHit = {
  _id?: string;
  _score?: number | null;
  _source?: unknown;
  /** The hit's index and collection, set on a multi-collection search */
  index?: string;
  collection?: string;
  highlight?: unknown;
  inner_hits?: unknown;
};

export type StorageSearchResult = {
  hits: StorageSearchHit[];
  total: number;
  /** Set when the search was a scroll, to fetch the next page */
  scrollId?: string;
  /** Documents left to fetch through the scroll */
  remaining?: number;
  aggregations?: JSONObject;
  suggest?: JSONObject;
};

export type StorageSearchOptions = {
  from?: number;
  size?: number;
  /** Scroll TTL (e.g. `"10s"`): makes the search a scroll */
  scroll?: string;
};

export type StorageInfo = {
  /** The engine, e.g. `"elasticsearch"` */
  type: string;
  version: string;
  status?: string;
};

export type StorageStats = {
  indexes: {
    name: string;
    /** In bytes */
    size: number;
    collections: {
      name: string;
      documentCount: number;
      /** In bytes */
      size: number;
    }[];
  }[];
  /** In bytes */
  size: number;
};

export type StorageCollectionOptions = {
  mappings?: JSONObject;
  settings?: JSONObject;
};

/** The mandatory core: every driver implements it. */
export interface StorageDriverCore {
  /**
   * Connects to the engine. Kuzzle applies `services.storageEngine`'s init
   * timeout around it.
   */
  init(): Promise<void>;

  info(): Promise<StorageInfo>;

  /**
   * Translates Koncorde filters to the driver's query language. A filter it
   * cannot translate raises a `KeywordError` (see `QueryTranslator`, which the
   * Elasticsearch-family drivers use).
   */
  translateKoncordeFilters(filters: JSONObject): JSONObject;

  // Indexes and collections

  createIndex(index: string): Promise<unknown>;
  /** @returns The indexes actually deleted */
  deleteIndexes(indexes?: string[]): Promise<string[]>;
  deleteIndex(index: string): Promise<unknown>;
  /** @returns Index name -> its collection names */
  getSchema(): Promise<Record<string, string[]>>;
  createCollection(
    index: string,
    collection: string,
    options?: StorageCollectionOptions,
  ): Promise<unknown>;
  deleteCollection(index: string, collection: string): Promise<unknown>;
  truncateCollection(index: string, collection: string): Promise<unknown>;
  refreshCollection(index: string, collection: string): Promise<unknown>;
  getMapping(
    index: string,
    collection: string,
    options?: { includeKuzzleMeta?: boolean },
  ): Promise<JSONObject>;
  getSettings(
    index: string,
    collection: string,
  ): Promise<JSONObject | undefined>;

  // Documents

  get(index: string, collection: string, id: string): Promise<StorageDocument>;
  /** @returns The documents found, and the ids of those that were not */
  mGet(
    index: string,
    collection: string,
    ids: string[],
  ): Promise<{ errors: string[]; items: StorageDocument[] }>;
  exists(index: string, collection: string, id: string): Promise<boolean>;
  /** @returns The ids found, and those that were not */
  mExists(
    index: string,
    collection: string,
    ids: string[],
  ): Promise<{ errors: string[]; items: string[] }>;
  count(
    index: string,
    collection: string,
    searchBody?: JSONObject,
  ): Promise<number>;
  create(
    index: string,
    collection: string,
    content: JSONObject,
    options?: StorageWriteOptions & { id?: string },
  ): Promise<StorageDocument>;
  createOrReplace(
    index: string,
    collection: string,
    id: string,
    content: JSONObject,
    options?: StorageWriteOptions,
  ): Promise<StorageDocument & { created: boolean }>;
  update(
    index: string,
    collection: string,
    id: string,
    content: JSONObject,
    options?: StorageWriteOptions & { retryOnConflict?: number },
  ): Promise<StorageDocument>;
  upsert(
    index: string,
    collection: string,
    id: string,
    content: JSONObject,
    options?: StorageWriteOptions & {
      defaultValues?: JSONObject;
      retryOnConflict?: number;
    },
  ): Promise<StorageDocument & { created: boolean }>;
  replace(
    index: string,
    collection: string,
    id: string,
    content: JSONObject,
    options?: StorageWriteOptions,
  ): Promise<StorageDocument>;
  delete(
    index: string,
    collection: string,
    id: string,
    options?: { refresh?: StorageRefresh },
  ): Promise<unknown>;
  deleteFields(
    index: string,
    collection: string,
    id: string,
    fields: string[],
    options?: { refresh?: StorageRefresh; userId?: string | null },
  ): Promise<StorageDocument>;
  mCreate(
    index: string,
    collection: string,
    documents: JSONObject[],
    options?: StorageMWriteOptions,
  ): Promise<StorageMResult>;
  mCreateOrReplace(
    index: string,
    collection: string,
    documents: JSONObject[],
    options?: StorageMWriteOptions & { limits?: boolean; source?: boolean },
  ): Promise<StorageMResult>;
  mUpdate(
    index: string,
    collection: string,
    documents: JSONObject[],
    options?: StorageMWriteOptions & { retryOnConflict?: number },
  ): Promise<StorageMResult>;
  mUpsert(
    index: string,
    collection: string,
    documents: JSONObject[],
    options?: StorageMWriteOptions & { retryOnConflict?: number },
  ): Promise<StorageMResult>;
  mReplace(
    index: string,
    collection: string,
    documents: JSONObject[],
    options?: StorageMWriteOptions,
  ): Promise<StorageMResult>;
  mDelete(
    index: string,
    collection: string,
    ids: string[],
    options?: { refresh?: StorageRefresh },
  ): Promise<{ documents: JSONObject[]; errors: JSONObject[] }>;
  /**
   * Imports raw documents and actions (fixtures, `bulk:import`), in the
   * Elasticsearch bulk format
   */
  import(
    index: string,
    collection: string,
    documents: JSONObject[],
    options?: StorageMWriteOptions,
  ): Promise<{ errors: JSONObject[]; items: JSONObject[] }>;

  // Search

  /**
   * Searches one collection (`index` + `collection`) or several (`targets`).
   * `searchBody` is an Elasticsearch search body.
   */
  search(
    query?: {
      index?: string;
      collection?: string;
      searchBody?: JSONObject;
      targets?: ValidatedTarget[];
    },
    options?: StorageSearchOptions,
  ): Promise<StorageSearchResult>;
  /** Fetches the next page of a search started with `scroll` */
  scroll(
    scrollId: string,
    options?: { scrollTTL?: string },
  ): Promise<StorageSearchResult>;
  deleteByQuery(
    index: string,
    collection: string,
    query: JSONObject,
    options?: { refresh?: StorageRefresh; size?: number; fetch?: boolean },
  ): Promise<{
    deleted?: number;
    documents: JSONObject[];
    failures: JSONObject[];
    total?: number;
  }>;
  /**
   * Runs `callback` on every page of documents matching `query`
   *
   * @returns The callback's answers, one per page
   */
  mExecute(
    index: string,
    collection: string,
    query: JSONObject,
    callback: (documents: JSONObject[]) => unknown,
    options?: { size?: number; scrollTTl?: string },
  ): Promise<unknown[]>;
}

/** Capability `updateByQuery` */
export interface StorageUpdateByQuery {
  updateByQuery(
    index: string,
    collection: string,
    query: JSONObject,
    changes: JSONObject,
    options?: {
      refresh?: StorageRefresh;
      size?: number;
      userId?: string | null;
    },
  ): Promise<{ errors: JSONObject[]; successes: JSONObject[] }>;
  bulkUpdateByQuery(
    index: string,
    collection: string,
    query: JSONObject,
    changes: JSONObject,
    options?: { refresh?: boolean },
  ): Promise<{ updated?: number }>;
}

/** Capability `mappingUpdates` */
export interface StorageMappingUpdates {
  updateMapping(
    index: string,
    collection: string,
    mappings?: JSONObject,
  ): Promise<JSONObject>;
  updateCollection(
    index: string,
    collection: string,
    options?: StorageCollectionOptions & { reindexCollection?: boolean },
  ): Promise<unknown>;
}

/** Capability `stats` */
export interface StorageStatsCapability {
  stats(): Promise<StorageStats>;
}

/**
 * Engine-specific steps Kuzzle runs when the driver has them, and skips
 * otherwise.
 */
export interface StorageEngineHooks {
  /**
   * Repairs the engine-side naming of the indexes and collections, when
   * `services.storageEngine.generateMissingAliases` is set
   */
  generateMissingAliases?(): Promise<unknown>;
  /** Waits until a new collection can be written to */
  waitForCollectionShards?(
    index: string,
    collection: string,
    timeout?: string,
  ): Promise<void>;
}

/**
 * A storage driver instance: the core, the capability groups it declared in
 * its manifest, and the engine hooks it has.
 */
export type StorageDriver = StorageDriverCore &
  Partial<
    StorageUpdateByQuery & StorageMappingUpdates & StorageStatsCapability
  > &
  StorageEngineHooks;

/**
 * What a driver package exports: Kuzzle builds one instance per storage scope
 * (public and private indexes).
 *
 * @typeParam TNativeClient - The engine's own client
 * @typeParam TConfig - What the driver reads of `services.storageEngine`
 */
export type StorageDriverClass<
  TNativeClient = unknown,
  TConfig extends JSONObject = JSONObject,
> = {
  new (config: TConfig, scope: storeScopeEnum): StorageDriver;
  /**
   * Builds a new engine client, distinct from the ones the driver instances
   * use: `app.storage.storageClient`, `app.storage.StorageClient` and
   * `context.constructors.ESClient` hand it to applications and plugins.
   *
   * @param clientConfig - `services.storageEngine.client`, with the overrides
   *   given to `app.storage.StorageClient`
   */
  createNativeClient(clientConfig: JSONObject): TNativeClient;
};
