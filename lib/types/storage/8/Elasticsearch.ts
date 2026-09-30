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

// Shared by both Elasticsearch versions.
export type { KuzzleInfo, KRequestBody } from "../KuzzleInfo";

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
