# Step 03 — The driver loader

**Status:** ✅ Done · **Opened:** 2026-10-29 · **Closed:** 2026-10-29 (merged as `b3cdc35de`) · **PR:** [#3101](https://github.com/kuzzleio/kuzzle/pull/3101) · Back to the [hub](../ADR-0003-storage-drivers.md)

## Goal

`services.storageEngine.driver` selects an external storage driver: Kuzzle finds the package, checks its manifest
before running its code, and runs the storage layer on its class. A request needing a capability the driver does not
declare is rejected with a dedicated error, and every cluster node must run the same driver. Without `driver`, the
built-in ES7 / ES8 drivers are selected by `majorVersion`, exactly as before.

## What was done

- `lib/core/storage/storageDriverLoader.ts`: `selectStorageDriver(config)` answers the driver class, its declared
  capabilities and its identity (`<package>@<version>`, `null` for a built-in driver), once per configuration object.
  For an external driver it resolves the package, finds its root (the `package.json` carrying its name), reads and
  checks `manifest.json` (`kuzzleVersion` range satisfied, `capabilities` all known), and only then `require()`s it
  and checks the export (the module or its `default`, a class with a static `createNativeClient`).
  `createNativeStorageClient` moved here from `builtInDrivers.ts`, so the raw client surfaces follow the selected
  driver. `assertDeclaredCapabilities` checks that a driver instance has the methods of the capabilities it declares.
- `ClientAdapter` selects its driver through the loader, keeps its `capabilities`, and rejects with
  `services.storage_driver.unsupported_capability` a capability method (`updateCollection`, `updateMapping`,
  `updateByQuery`, `bulkUpdateByQuery`, `stats`) or a search with `aggregations` / `aggs` the driver did not declare.
  This replaces step 02's `core.fatal.assertion_failed` placeholder.
- Cluster: the ID card carries `storageDriver` (left out with a built-in driver), and the joining node is refused with
  `cluster.join.storage_driver_mismatch` (and shuts down, like the other `cluster.join.*` errors) when a discovered
  node's differs from its own.
- `StorageEngine` logs the external driver it runs on; the ES7 / ES8 log line is unchanged.
- Config: `driver?: string` in `StorageEngineElasticsearch`, documented in `.kuzzlerc.sample.jsonc`. No default.
- Errors: new subdomain `services.storage_driver` (`not_found`, `invalid_manifest`, `version_mismatch`,
  `invalid_driver`, `unsupported_capability`) and `cluster.join.storage_driver_mismatch`; error-code docs regenerated.
- Docs: "Storage Drivers" section in `doc/2/guides/main-concepts/data-storage/index.md` (configuration, manifest check,
  capabilities, cluster rule, integrated client). The upgrade notes and the changelog come with the release wrapup.
- `lib/types/semver.d.ts` declares `validRange`.
- Tests: `tests/core/storage/storageDriverLoader.test.ts` (driver packages written to a temporary application
  directory), capability cases in `tests/core/storage/clientAdapter.test.ts`, join cases in
  `tests/cluster/node.test.ts`, ID card cases in `tests/cluster/idCardHandler.test.ts`, the external-driver log in
  `tests/core/storage/storageEngine.test.ts`.

## Local decisions / gotchas

- **The built-in drivers are not compared at join.** A card without `storageDriver` is a built-in node, which is also
  what a node of an older Kuzzle writes: an ES7 / ES8 cluster joins exactly as before, including a mixed
  `majorVersion` one, which Kuzzle never refused. Built-in and external nodes are refused together.
- **A driver upgrade is a full cluster restart**, not a rolling one: decision 9 compares the version too. Stated in
  the guide.
- **Resolution: from the application first** (`process.cwd()`), then from Kuzzle itself. The application installs
  the driver next to `kuzzle`; resolving from Kuzzle only fails with a linked or strictly isolated `kuzzle`.
- **The package root is found by name**, walking up from the entry point: `<name>/package.json` cannot be resolved
  when `exports` does not list it, and dual builds ship nested `package.json` files.
- **Capability methods are checked on the instance**, at `ClientAdapter` construction: a method may be an instance
  property, which a prototype check would miss.
- **`unsupported_capability` is a `BadRequestError`** (400): the request is valid API, the configured engine cannot
  serve it.
- **`createNativeStorageClient` answers `unknown`**: the public `storageClient` / `StorageClient` / `ESClient` types
  stay what v2 declared them; with an external driver they hold the engine's own client.

## Validation

- `npm run build`, `npm run typecheck:tests`, `npm run typecheck:typings`, `npm run test:lint`, `npm run ratchet`: OK
  (casts 78 = baseline: the loader narrows with type guards).
- Unit suite (Docker): 171 files, 4 526 tests passed.
- Functional, websocket profile, Docker path (`--tags "not @http and not @network"`): ES7 160 / 164 scenarios passed,
  ES8 162 / 164, the rest skipped by the suite — the same counts as step 02. The one failure on each is
  `Websocket.feature:5` (`ECONNREFUSED 127.0.0.1:7512`), the Docker path's known localhost limit.
