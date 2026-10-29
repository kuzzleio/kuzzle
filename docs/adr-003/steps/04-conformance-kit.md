# Step 04 — The conformance kit

**Status:** 🟦 In progress · **Opened:** 2026-10-29 · **PR:** [#3102](https://github.com/kuzzleio/kuzzle/pull/3102) · Back to the [hub](../ADR-0003-storage-drivers.md)

## Goal

A driver author proves their driver works with Kuzzle without reading Kuzzle's code: `kuzzle` ships a conformance
kit, a test suite the driver's repository runs against its real engine (decision 12). It covers the mandatory core and
each capability group the driver declares, and skips the others. Kuzzle runs the same kit against its built-in ES7 /
ES8 drivers, which proves the kit itself. In the functional suite (cucumber), the scenarios needing a capability are
tagged, so the suite can run against a driver that does not declare it.

## Design choices (maintainer, 2026-10-29)

- **Packaging: in `kuzzle`, without a test runner.** `describeStorageDriverConformance` registers its cases through
  the `describe` / `it` / `beforeAll` / `afterAll` the driver repository hands it, and asserts with `node:assert`:
  `kuzzle` neither depends on nor loads vitest, and the kit works with vitest, jest or mocha.
- **Where Kuzzle runs it: a dedicated CI job** (`storage-conformance`, ES7 and ES8), through
  `.ci/scripts/docker-test.sh conformance`. The unit suite stays engine-free.
- **Capability tags: `@capability-<name>`** on the scenarios needing one; `KUZZLE_STORAGE_CAPABILITIES` (the
  manifest's list) excludes the others, unset means all of them.
- **Cross-repo loop: the contract stays backward-compatible within a minor** (only additions: optional methods or
  capabilities). Kuzzle's matrix tests the published drivers; a released driver stays valid. No cross-repo CI.

## What was done

- `lib/core/storage/conformance/`: `describeStorageDriverConformance({ Driver, capabilities, config?, test,
  indexPrefix? })`, exported by `kuzzle`. It builds one driver per scope over Kuzzle's default
  `services.storageEngine` merged with `config`, creates a `conformance-<random>` index, deletes it after.
  - `coreCases.ts`: 27 cases — engine info, Koncorde translation (and the `KeywordError` shape when a keyword cannot
    be translated), scope isolation of the indexes, index / collection lifecycle and mappings (with and without
    `_kuzzle_info`), the document actions with their Kuzzle error ids, the `m*` actions, `import`, `count`,
    `search` (sort, pagination, several collections), `scroll`, `mExecute`, `deleteByQuery`, the shard-wait hook.
  - `capabilityCases.ts`: one case per capability group, registered only when declared.
  - `conformanceEnvironment.ts`: a stand-in for `global.kuzzle` while the kit runs (logger, configuration, `hash`,
    `emit`, the internal cache, and the in-memory lock commands `withLock` sends to it), left out when a Kuzzle
    instance is there, and restored after.
- Kuzzle's own run: `tests/conformance/builtInDrivers.conformance.ts` (`npm run test:conformance`, its own vitest
  config), CI job `storage-conformance` (ES7, ES8), and the Sonar job runs it on ES8 for the cases' coverage
  (`coverage/conformance/lcov.info`).
- Unit: `tests/core/storage/conformance/` (registration, hooks, stand-in, assertions, capability tags).
- Typings gate: `tests/typings/consumer/storageDriverConformance.ts` registers the kit with vitest's functions.
- Contract JSDoc: the `m*` documents format (`{ _id?, body }`, `mUpsert`'s `{ _id, changes, default? }`).
- Functional suite: `@capability-*` tags (4 `mappingUpdates`, 2 `stats`, 3 `updateByQuery` scenarios, 7
  `mappingUpdates` legacy ones; no scenario uses aggregations), `cucumber.config.cjs` reads
  `KUZZLE_STORAGE_CAPABILITIES`, and `start-kuzzle-test.ts` skips its `app.import.userMappings` without
  `mappingUpdates`. `features/fixtures/storage-driver-core-only` (the built-in driver under a manifest
  declaring nothing) and `.ci/test-cluster-core-only-driver.yml` run the suite on it:
  `STORAGE_DRIVER=core-only .ci/scripts/docker-test.sh functional <suite>`.
- Docs: "Writing a driver" in `doc/2/guides/main-concepts/data-storage/index.md`; `docker-tests` skill, AGENTS.md.

## Local decisions / gotchas

- **A driver may use `global.kuzzle`** as the built-in drivers do; the kit's stand-in pins what that means. It is
  installed over the throwing getter `kuzzle.ts` defines until Kuzzle is built (a driver repository importing
  `kuzzle` has it), and the getter is put back after.
- **`withLock` needs the internal cache's Redis client** (`core:cache:internal:client:get`): the stand-in answers the
  three commands redis-semaphore sends (`SET NX PX`, the release and extend scripts) in memory. One process only.
- **Error ids are pinned where the built-in drivers agree**: `not_found` on get / replace / delete, but `update` of a
  missing document answers `unexpected_not_found`, so the kit only asks a 404 there.
- **The `m*` input format is `{ _id?, body }`**, not `_source`: found by the kit, now in the contract's JSDoc.
- **The conformance run has its own compose project** (`kuzzle-conformance`): the functional path's `down -v` and
  this one must not tear each other's stack down.
- **`app.import.userMappings` needs `mappingUpdates`**: it updates the users' mappings. The first core-only run
  showed Kuzzle refusing to start on it, with the capability error; now stated in the guide's capability table.
- **The core-only fixture is mounted at `/node_modules`**, out of the checkout's `node_modules` that `npm ci` empties;
  the loader finds it walking up from `/var/app`.

## Validation

- Kit against the built-in drivers: ES7 32 / 32, ES8 32 / 32 (local ES and `docker-test.sh conformance`). A driver
  with `mExists` and `upsert` deliberately broken fails exactly those two cases.
- Functional suite on the core-only driver (websocket, ES8, Docker path, `--tags "not @http and not @network"`):
  153 / 155 passed, the 9 `@capability-*` scenarios excluded; the one failure is `Websocket.feature:5`, the Docker
  path's known localhost limit. A missed tag shows up as a clean `unsupported_capability` failure (found
  `CollectionLock.feature:64` that way).
- Unit suite: 173 files, 4 539 tests passed. Build, `typecheck:tests`, `typecheck:typings`, lint, prettier, ratchets
  (casts 78 = baseline): OK.
