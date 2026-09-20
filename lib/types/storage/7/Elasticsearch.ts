import type { ByteSize, ClusterNodesStats } from "sdk-es7/api/types";

export type InfoResult = {
  type: string;
  version: string;
  status?: string;
  lucene?: string;
  spaceUsed?: ByteSize;
  nodes?: ClusterNodesStats;
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

export interface JSONObject {
  [key: string]: any;
}

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

/**
 * One row of a `cat.aliases` answer, once the two fields Elasticsearch always
 * fills have been narrowed — see `Elasticsearch._catAliases`.
 */
export type CatAliasRecord = {
  alias: string;
  index: string;
};
