---
code: false
type: page
order: 12
title: Upgrading from 2.62 | Upgrade notes | Guide | Core
meta:
  - name: description
    content: What you can observe when you upgrade Kuzzle from v2.62 to v2.63, and what to check
  - name: keywords
    content: Kuzzle, Documentation, upgrade, 2.63, search, min_score, track_scores, storage drivers, index cache, release notes
---

# Upgrading from 2.62

This page covers Kuzzle **2.63**, starting with its first beta, 2.63.0-beta.1. If you upgrade from an older version, read the [previous upgrade notes](/core/2/guides/upgrade-notes/from-2-61) too.

The API, the configuration and the TypeScript declarations stay compatible with v2.62.0. Items that may need an action on your side are marked **Action**.

The changelog is generated from the commits and says what was done. This page says what you may have to check.

### `min_score` and `track_scores` in a search body

A [document:search](/core/2/api/controllers/document/search) body may now use `min_score` and `track_scores`. They used to be refused with `services.storage.invalid_search_query`. With `lang: "koncorde"`, the score comes from the Elasticsearch query the filters are translated to: an `and`, for instance, gives every document a score of 0, so any `min_score` above 0 leaves them all out. [document:count](/core/2/api/controllers/document/count) does not take them: depending on the storage engine, the count request is refused.

**Action:** none. With a storage driver older than `kuzzle-storage-es-7` / `-es-8` / `-es-9` 1.3.0 or `kuzzle-storage-opensearch-2` / `-3` 1.1.0 (set with `services.storageEngine.driver`), both keys are still refused: upgrade the driver to use them.

### `services.storageEngine.search.additionalBodyKeys`

This new option, an empty array by default, lists root keys a search body may use on top of the default ones (for instance `["indices_boost", "rescore"]`). The storage driver reads it at startup:

- a value that is not an array of non-empty strings, or a key Kuzzle sets itself on every search (`index`, `pit`, `profile`, `rest_total_hits_as_int`, `routing`, `scroll`, `track_total_hits`), makes the startup fail with a message naming the option;
- inline scripts stay refused under any key: only stored scripts are accepted;
- the driver does not check that the engine knows an added key: an unknown one is answered with the engine's own error.

**Action:** none. If you set it, set the same list on every node of the cluster. A storage driver older than the versions above ignores it.

### Built-in storage drivers 1.3.0

The built-in Elasticsearch 7 and 8 drivers are `kuzzle-storage-es-7` and `kuzzle-storage-es-8` 1.3.0. Their `kuzzle` peer dependency is now optional: when Kuzzle is itself the application (its repository, its Docker image), npm no longer installs a second copy of Kuzzle under `node_modules`, and the drivers get the running Kuzzle.

**Action:** none.

### Index cache reloads

A node reloads its index cache when it joins the cluster, when it goes live and on [admin:refreshIndexCache](/core/2/api/controllers/admin/refresh-index-cache). The indexes and collections changed during that reload keep the state the node knows, which is newer than the read. An index or a collection changed twice during the reload (removed then created again, or created then removed) used to look unchanged and took the state read from the storage: the node could answer `services.storage.unknown_collection` for an existing collection, or keep one that no longer exists, until the next reload. When two reloads overlap, the read that started last now wins.

**Action:** none.

### Dependencies

`koncorde` 4.8.1, `kuzzle-espresso-logic-minimizer` 2.3.1, `re2` 1.27.2 and `kuzzle-sdk` 7.19.1, with a refreshed lockfile: `npm audit --omit=dev` reports no advisory. Kuzzle now requires `kuzzle-sdk` `>=7.19.1 <8.0.0`: an application that installs `kuzzle` can no longer resolve an older SDK, whose `ws` has known advisories. `koncorde` 4.8.1 needs Node.js 22 or later: Kuzzle already does (`engines`: `>=22.12.0`).

On Node.js 22.12 to 22.22.1, npm prints an `EBADENGINE` warning for `re2`: it is harmless, the prebuilt binary works. Upgrading Node.js 22 silences it.

**Action:** none.
