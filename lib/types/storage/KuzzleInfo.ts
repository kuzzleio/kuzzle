// Shared by the Elasticsearch 7 and 8 storage types, which re-export both
// under the names they have always exported.

/**
 * Kuzzle's own metadata, stored alongside every document it writes.
 *
 * `author` and `updater` are kuids, and `getKuid` answers `null` for an
 * anonymous write — so both are nullable, as is `updatedAt` on a document that
 * has only ever been created.
 *
 * Wider than the API contract's `KDocumentKuzzleInfo`, whose `author` is a
 * `string`: that type describes what a client is handed, this one what the
 * storage layer may write. Kept apart on purpose.
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
