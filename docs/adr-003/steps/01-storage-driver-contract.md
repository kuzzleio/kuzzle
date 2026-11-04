# Step 01 — The `StorageDriver` contract

**Status:** ✅ Done — frozen · **Opened / merged:** 2026-10-29 · **PR:** [#3099](https://github.com/kuzzleio/kuzzle/pull/3099) · Back to the [hub](../ADR-0003-storage-drivers.md)

## Goal

Define what a storage driver implements — a mandatory core, optional capability groups, a manifest — export it from
`kuzzle`, and pin it with the typings gate. Types only: nothing loads a driver yet (step 03), and the storage layer
still instantiates the Elasticsearch classes directly (step 02).

## What was done

- `lib/types/storage/StorageDriver.ts`, exported by `kuzzle` through `lib/types/index.ts`:
  - `StorageDriverCore<TNativeClient>`: the mandatory core — `init`, `getNativeClient`, `info`,
    `translateKoncordeFilters`, index and collection management, every document action (single and `m*`), `search`,
    `scroll`, `count`, `deleteByQuery`, `mExecute`, `import`.
  - Capability groups, optional members of `StorageDriver`: `StorageUpdateByQuery` (`updateByQuery`,
    `bulkUpdateByQuery`), `StorageMappingUpdates` (`updateMapping`, `updateCollection`), `StorageStatsCapability`
    (`stats`); `aggregations` has no method of its own (it is part of a search body). `STORAGE_CAPABILITIES` lists
    their names, `StorageCapability` types them.
  - `StorageEngineHooks`: `generateMissingAliases`, `waitForCollectionShards` — optional, skipped when absent, no
    capability to declare.
  - `StorageDriverManifest` (`kuzzleVersion`, `capabilities`), `StorageDriverClass` (the exported constructor:
    `(config, scope)`), and the argument and answer types.
- `tests/core/storage/storageDriver.test.ts`: the built-in `ES7` and `ES8` classes satisfy the contract as they are,
  minus the two members a thin driver adds (`init`, `getNativeClient`); a core-only driver is a valid driver.
  Checked by `npm run typecheck:tests`.
- `tests/typings/consumer/storageDriver.ts`: a third-party driver written against the published typings.
- `lib/service/storage/7/elasticsearch.ts`: `stats()`'s collection entries typed as they are built (type only).

## Local decisions / gotchas

- **Methods = today's, as they are** (maintainer, 2026-10-29): same names, arguments and answers as what
  `ClientAdapter` calls, so step 02's ES7 / ES8 drivers stay thin and ES9 / OpenSearch implement them directly. A SQL
  driver (v3) may call for a revision.
- **What Kuzzle itself needs is core, not a capability.** The security repositories scroll users and profiles, user
  deletion runs `deleteByQuery` on API keys, the internal models use `mExecute`, fixtures use `import`: a driver
  without them would break Kuzzle's own index, so they cannot be optional.
- **Four broad capability groups** (`aggregations`, `mappingUpdates`, `stats`, `updateByQuery`) rather than one per
  method: in v2 every ES-family driver declares them all; adding a group later is non-breaking.
- **Manifest = a `manifest.json` file at the package root** (maintainer, 2026-10-29), as for plugins: read, and an
  incompatible driver refused, before its code runs. No `name`: the package name (the `driver` config value) is the
  driver's identity. Its loader errors get their own domain in step 03, not `plugin.manifest.*`.
- **Answer types are as loose as the Elasticsearch SDK types them** (`_source: unknown`, optional hit `_id`), so both
  built-in classes satisfy the contract without a cast; `getSettings` may answer `undefined`.

## Validation

- `npm run build`, `npm run typecheck:typings` (strict and loose), `npm run typecheck:tests`: OK.
- Unit suite: 168 files, 4 472 tests passed. `pr-preflight`: OK.
