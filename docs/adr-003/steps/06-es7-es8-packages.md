# Step 06 — Elasticsearch 7 and 8 as packages Kuzzle depends on

**Status:** 🟦 In progress · **Opened:** 2026-10-30 · **PR:** — · Back to the [hub](../ADR-0003-storage-drivers.md)

## Goal

The ES7 and ES8 drivers leave the core for their own packages, `kuzzle-storage-es-7` and `kuzzle-storage-es-8`, and
`kuzzle` depends on them at pinned versions: every engine then runs through the same driver path as ES9. Nothing
changes for an ES7 / ES8 stack (decision 8): same `.kuzzlerc`, same `package.json`, `majorVersion` still selects the
driver. The next major only drops the two dependencies (step 08).

## Design choices (maintainer, 2026-10-30)

- **One public repository per driver**, `kuzzleio/storage-es-7` and `kuzzleio/storage-es-8`, released like
  `storage-es-9` (semantic-release, `master` stable / `beta` prerelease, npm trusted publishing).
- **The code moves as it is**: `lib/service/storage/<7|8>/` and its `ES7Driver` / `ES8Driver` wrapper, no
  factorisation (decision 10). Each package exports its driver class and ships a `manifest.json`.
- **Pinned versions** in `kuzzle`'s `dependencies`: a driver release reaches users only through a `kuzzle` release.
- **Lazy loading**: a driver `require`s `kuzzle`, so `kuzzle` loads the built-in one at storage startup, not at
  module load, to avoid a require cycle.
- Names reserved on npm by an empty `0.0.0` (published by the maintainer, 2026-10-30).

## Parts

| Part | What | Where | Status |
| --- | --- | --- | --- |
| A | `kuzzle-storage-es-7`: the ES7 code and driver, manifest, conformance kit on ES7 in CI, first beta | storage-es-7 | ⬜ |
| B | `kuzzle-storage-es-8`: the same for ES8 | storage-es-8 | ⬜ |
| C | `kuzzle` depends on both at pinned versions, loads them lazily, drops `lib/service/storage/7` / `8`; ES7 / ES8 matrix unchanged | kuzzle | ⬜ |

## What was done

## Local decisions / gotchas

- To check in part C: `lib/types/storage/7|8/Elasticsearch.ts` import types from `sdk-es7` / `sdk-es8`, so the two
  SDKs likely stay direct `kuzzle` dependencies through v2 for the public typings; they leave at the next major.

## Validation
