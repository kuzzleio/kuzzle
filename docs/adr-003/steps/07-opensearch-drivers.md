# Step 07 — OpenSearch 2 and 3 drivers

**Status:** 🟦 In progress · **Opened:** 2026-11-02 · **PR:** [#3125](https://github.com/kuzzleio/kuzzle/pull/3125) · Back to the [hub](../ADR-0003-storage-drivers.md)

## Goal

OpenSearch runs under Kuzzle 2 through two external drivers, `kuzzle-storage-opensearch-2` (OpenSearch `>=2.19 <3`)
and `kuzzle-storage-opensearch-3` (OpenSearch `>=3 <4`), each in its own repository, released in the 2.61 beta period
alongside the ES9 driver. Kuzzle's functional matrix runs on both. An ES7 / ES8 stack changes nothing (decision 8).

## Design choices (maintainer, 2026-11-02)

- **Two packages, one per OpenSearch major**, as the version ranges given: `>=2.19 <3` and `>=3`. It settles the hub's
  open point on package granularity: the OpenSearch client has one major per server major (client 2.x for OpenSearch
  2, 3.x for OpenSearch 3), as the Elasticsearch drivers do.
- **Shipped in the current beta** (2.61.0-beta.5), with the ES9 driver: same release path (repositories created by
  Claude, `beta` first, npm trusted publishing, docs on next-docs first).

## Local decisions (Claude, 2026-11-02)

- **The drivers start as a copy of the ES7 driver** (`kuzzle-storage-es-7`), not ES8 / ES9: the OpenSearch client is a
  fork of the Elasticsearch 7 client and answers in its envelope (`{ body, statusCode, headers }`). Only the client
  import, the types and the version check change.
- **The version check also reads `distribution`**: an Elasticsearch cluster, or an OpenSearch version out of the
  driver's range, is refused with `services.storage.version_mismatch` (`lib/version.ts`, unit-tested).
- **OpenSearch 3's client is typed strictly** (every request body and response); the driver's code keeps the shape it
  had with client 2 through a thin view of the client, `lib/clientTypes.ts`, rather than a rewrite of 4 000 lines.
- **Client 3 no longer turns camelCase parameters into snake_case**: the one camelCase query parameter the ES7 code sent
  (`trackTotalHits`) is now `track_total_hits` in both drivers.
- **Kuzzle's CI stages any external driver with one script**, `.ci/scripts/stage-storage-driver.sh <es9|opensearch2|opensearch3>`
  (replaces `stage-es9-driver.sh`), and an overlay per engine on the ES 8 cluster file
  (`.ci/test-cluster-opensearch<N>-driver.yml`). `STORAGE_DRIVER_SPEC` picks what npm installs (`ES9_DRIVER` still read
  for es9). New CI job `functional-tests-opensearch-drivers` (both drivers × five suites, `beta` tag until 1.0.0).

## Parts

| Part | What | Where | Status |
| --- | --- | --- | --- |
| A | `kuzzle-storage-opensearch-2`: the ES7 driver on the OpenSearch 2 client, version check, conformance kit + unit suite in CI on OpenSearch 2.19.0 / 2.19.7, README + `doc/1/`, first beta | storage-opensearch-2 | ✅ `kuzzle-storage-opensearch-2@1.0.0-beta.1` published 2026-11-02 (semantic-release, CI green) |
| B | `kuzzle-storage-opensearch-3`: the same on the OpenSearch 3 client, CI on 3.0.0 / 3.9.0 | storage-opensearch-3 | ✅ `kuzzle-storage-opensearch-3@1.0.0-beta.1` published 2026-11-02 (semantic-release, CI green) |
| C | Kuzzle: CI staging generalised, functional matrix on both drivers, docs (data storage guide, changelog, upgrade notes, `.kuzzlerc.sample.jsonc`) | kuzzle | ✅ [#3125](https://github.com/kuzzleio/kuzzle/pull/3125) merged, shipped in `2.61.0-beta.5` (published 2026-11-02) |
| D | docs.kuzzle.io: the two drivers registered in the "Drivers" section (documentation repository), on next-docs first | documentation | ✅ [documentation#613](https://github.com/kuzzleio/documentation/pull/613) merged 2026-11-02, on next-docs |

## Validation

- `kuzzle-storage-opensearch-2`: conformance kit 32 / 32 on OpenSearch 2.19.0 and 2.19.7; unit suite 293 passed
  (the ES7 suite + the version check).
- `kuzzle-storage-opensearch-3`: conformance kit 32 / 32 on OpenSearch 3.0.0 and 3.9.0; unit suite 292 passed.
- Kuzzle's functional suites on both drivers: the 10 CI jobs (5 suites × 2 drivers) green on #3125 with the drivers
  at `1.0.0-beta.2`, with the rest of the matrix.

## Gotchas

- **Kuzzle asks `deleteByQuery` for no limit with `size: -1`** (`bulk:deleteByQuery`): Elasticsearch 7 accepted it,
  OpenSearch refuses it (`[max_docs] parameter cannot be negative`). Found by the first CI run of the functional suites
  on both drivers (http and websocket); the drivers omit a negative `size` (storage-opensearch-2#1, -3#1, `1.0.0-beta.2`).

- **A full Docker disk makes OpenSearch refuse index creation** (`cluster create-index blocked`, flood-stage
  watermark): the conformance kit then fails in `createIndex`. Locally, free space or disable
  `cluster.routing.allocation.disk.threshold_enabled`.
