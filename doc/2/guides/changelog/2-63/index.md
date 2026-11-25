---
code: false
type: page
order: 370
title: Kuzzle 2.63 | Changelog | Guide | Core
meta:
  - name: description
    content: What Kuzzle 2.63 changes, in plain words
  - name: keywords
    content: Kuzzle, Documentation, changelog, 2.63, search, min_score, track_scores, storage drivers, index cache
---

# Kuzzle 2.63

**Status:** in beta since 2026-11-25 (2.63.0-beta.1).

The [GitHub release notes](https://github.com/kuzzleio/kuzzle/releases) list every commit. This page tells you what changes for you. For what to check before you upgrade, read [Upgrading from 2.62](/core/2/guides/upgrade-notes/from-2-62).

## 2.63.0

### In short

Searches accept `min_score` and `track_scores`, and an administrator can allow more root keys in a search body. A node no longer loses track of an index or a collection changed twice while it reloads its index cache. The production dependencies are free of known advisories.

### What you need to do

Nothing.

### What's new

- **Relevance in searches.** A [document:search](/core/2/api/controllers/document/search) body accepts `min_score`, which leaves out the documents whose relevance score is lower, and `track_scores`, which keeps the score of each document when the results are sorted on another field. A [Koncorde query](/core/2/api/koncorde-filters-syntax) has no score: with `lang: "koncorde"`, any `min_score` above 0 answers no document.
- **More root keys in a search body, on demand.** The new `services.storageEngine.search.additionalBodyKeys` option lists root keys a search body may use on top of the default ones (see [Querying](/core/2/guides/main-concepts/querying)). Inline scripts stay refused under any key, and Kuzzle refuses to start on a key it sets itself on every search (`index`, `pit`, `profile`, `rest_total_hits_as_int`, `routing`, `scroll`, `track_total_hits`). It is read by the storage drivers `kuzzle-storage-es-7`, `-es-8` and `-es-9` from 1.3.0, and `kuzzle-storage-opensearch-2` and `-3` from 1.1.0.
- **For driver authors:** the conformance kit checks that a driver answers `min_score` and `track_scores`.

### What's fixed

- **Index cache reloads.** A node reloads its list of indexes and collections when it joins the cluster, when it goes live and on [admin:refreshIndexCache](/core/2/api/controllers/admin/refresh-index-cache). An index or a collection removed then created again (or created then removed) during that reload took the state read from the storage, which could be the one in between: the node then answered `unknown_collection` for an existing collection, or kept one that no longer exists, until the next reload. Two reloads overlapping at startup could also end with the older read winning ([#3126](https://github.com/kuzzleio/kuzzle/issues/3126)).
- **The documentation of the allowed search keys** now lists them all: `post_filter`, `search_after` and `suggest` were already accepted.

### Under the hood

- `kuzzle-storage-es-7` and `kuzzle-storage-es-8` 1.3.0: `min_score`, `track_scores` and `search.additionalBodyKeys`. Their `kuzzle` peer dependency is optional: an application that is Kuzzle itself (its repository, its Docker image) no longer installs a second copy of Kuzzle, and the drivers get the running one.
- `koncorde` 4.8.1 (`re2` 1.27.2, `kuzzle-espresso-logic-minimizer` 2.3.1) and `kuzzle-sdk` 7.19.1, and a refreshed lockfile: no known advisory left in the production dependencies (`npm audit --omit=dev`). `koncorde` 4.8.1 needs Node.js 22 or later, as Kuzzle does.
