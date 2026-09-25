import type { estypes } from "sdk-es8";

import type { JSONObject } from "../../JSONObject";

export type InfoResult = {
  type: string;
  version: string;
  status?: string;
  lucene?: string;
  spaceUsed?: estypes.ByteSize;
  nodes?: estypes.ClusterStatsClusterNodes;
};

export type KUpdateResponse = {
  _id: string;
  _source: unknown;
  _version: number;
};

export type KStatsIndexesCollection = {
  documentCount: number;
  name: string;
  size: estypes.ByteSize;
};

export type KStatsIndex = {
  collections: KStatsIndexesCollection[];
  name: string;
  size: estypes.ByteSize;
};

export type KStatsIndexes = {
  [key: string]: KStatsIndex;
};

export type KStats = {
  indexes: KStatsIndex[];
  size: estypes.ByteSize;
};

/**
 * Kuzzle's own metadata, stored alongside every document it writes.
 *
 * `author` and `updater` are kuids, and `getKuid` answers `null` for an
 * anonymous write — so both are nullable, as is `updatedAt` on a document that
 * has only ever been created.
 */
export type KuzzleInfo = {
  author: string | null;
  createdAt: number;
  updatedAt: number | null;
  updater: string | null;
};

/**
 * `_kuzzle_info` is `Partial` because a partial update writes only the two
 * fields it owns (`updatedAt`, `updater`) and leaves the creation pair to the
 * document already in the index.
 */
export type KRequestBody<T> = T & {
  _kuzzle_info?: Partial<KuzzleInfo>;
};

// Kuzzle's own `JSONObject` (ADR-0002 step 02, TD-10), re-exported under the
// name this module has always exported.
export type { JSONObject } from "../../JSONObject";

export type KImportError = {
  _id?: string | null;
  // The bulk response echoes an HTTP status code, which is a number.
  status: number;
  _source?: JSONObject;
  error?: {
    reason: string;
    type: string;
  };
};

export type KRequestParams = {
  refresh?: boolean | "wait_for";
  timeout?: string;
  userId?: string | null;
  injectKuzzleMeta?: boolean;
  limits?: boolean;
  source?: boolean;
};

/**
 * Maps an ES alias to the index/collection pair a multi-target search resolved
 * it from — see `Elasticsearch._mapTargetsToAlias`.
 */
export type AliasToTargets = {
  [alias: string]: { collection: string; index: string };
};

/**
 * One row of a `cat.aliases` answer, once the two fields Elasticsearch always
 * fills have been narrowed — see `Elasticsearch._catAliases`.
 */
export type CatAliasRecord = {
  alias: string;
  index: string;
};

/**
 * The standardised answer `_mExecute` builds for every m* write: the documents
 * Elasticsearch accepted, and the ones it (or Kuzzle) rejected.
 */
export type KMExecuteResult = {
  errors: JSONObject[];
  items: JSONObject[];
};

/**
 * The answer `import` builds from a bulk response: one entry per action, keyed
 * by the action name Elasticsearch echoed back.
 */
export type KImportResult = {
  errors: Array<Record<string, KImportError>>;
  items: Array<Record<string, { _id?: string | null; status?: number }>>;
};
