# Step 05 — The first external driver: Elasticsearch 9

**Status:** 🟦 In progress · **Opened:** 2026-10-30 · **PR:** [#3103](https://github.com/kuzzleio/kuzzle/pull/3103) (part A) · Back to the [hub](../ADR-0003-storage-drivers.md)

## Goal

Elasticsearch 9 runs under Kuzzle 2 through an external driver, `@kuzzleio/storage-es-9`, in its own repository: the
first driver written against the contract, the loader and the conformance kit of steps 01–04, outside the core.
Kuzzle's functional matrix runs on it, and `majorVersion` is deprecated in the documentation. An ES7 / ES8 stack
changes nothing (decision 8).

## Design choices (maintainer, 2026-10-30)

- **Repository: `kuzzleio/storage-es-9`, public**, Apache-2.0, created by Claude.
- **Kuzzle's CI installs the driver from npm**, a beta first, as a user would: the matrix tests published drivers
  (register, 2026-10-29). Only the maintainer publishes; Claude hands the commands.
- **The driver starts as a copy of the ES8 driver**, adapted to the Elasticsearch 9 client: proven in production, and
  the conformance kit checks the result. The code is duplicated, as decision 10 plans for v2.

## Parts

| Part | What | Where | Status |
| --- | --- | --- | --- |
| A | What a driver needs from `kuzzle` and cannot copy: `storageError` (the `services.storage.*` errors); `kuzzle` beta carrying it and the conformance kit | kuzzle | 🟦 #3103 merged 2026-10-30; `2.61.0-beta.1` pending |
| B | The driver: ES8 code adapted to the ES9 client, manifest, conformance kit in its CI on ES9, `1.0.0-beta.1` | storage-es-9 | ⬜ |
| C | Kuzzle's functional matrix on ES9 with the published driver; `majorVersion` deprecated (doc); warning when `driver` and `majorVersion` are both set; docs | kuzzle | ⬜ |

- **No startup deprecation notice for `majorVersion` in v2** (maintainer, 2026-10-30): an ES7 / ES8 stack has nothing
  else to use in v2, so the notice would show at every start with no action possible. Kuzzle warns only when `driver`
  and `majorVersion` are both set (`majorVersion` is then ignored); the rest goes in the documentation.

## What was done

- Part A: `storageError` (`lib/core/storage/storageError.ts`) exported by `kuzzle`, `kerror.wrap("services",
  "storage")`: a driver throws Kuzzle's storage errors (class, status, documented message) with no deep import.
  Unit test and typings gate (`tests/typings/consumer/storageDriver.ts`).
- Part C, ahead of the CI job: `ES_VERSION=8 STORAGE_DRIVER=es9 .ci/scripts/docker-test.sh functional <suite>` runs the
  cluster on Elasticsearch 9 with the driver installed by `.ci/scripts/stage-es9-driver.sh` (npm spec, default
  `@kuzzleio/storage-es-9@beta`, or `ES9_DRIVER=<.tgz>`), overlay `.ci/test-cluster-es9-driver.yml`.
- Part B, local (`~/Code/storage-es-9`, not pushed yet): the ES8 classes copied, imports moved to `kuzzle`'s exports
  and the ES9 client; only fix the client needed: `indices.updateAliases` takes `actions` at the top level.

## Local decisions / gotchas

- **What the ES8 driver imports from Kuzzle's internals**: only `services.storage.*` errors need an export (their
  catalogue lives in `kuzzle`); `QueryTranslator`, `withLock`, `storeScopeEnum`, the error classes are already
  exported, and the small helpers (`didYouMean`, `extractFields`, `assertIsObject`, `isPlainObject`, `debug`) are
  copied into the driver.
- **In Kuzzle's own cluster, the driver's `require("kuzzle")` must reach the running checkout**, not a copy: Kuzzle
  checks its errors with `instanceof`. `features/fixtures/kuzzle-self` (at `/node_modules/kuzzle`) re-exports
  `/var/app/index.ts`, which ts-node already serves.
- **2-dev's `package.json` keeps the last release's version** (2.60.1), so the staging script opens the staged
  manifest's `kuzzleVersion` to `*`: the range check is the loader's, unit-tested.
- **The driver repository needs a `kuzzle` release** carrying the kit and `storageError`: `2.61.0-beta.1`, cut from
  `2-dev` once part A is merged. Until then the driver is developed against a local build of `kuzzle`.

## Validation

- Driver, conformance kit: 32 / 32 on Elasticsearch 9.0.8 and 9.5.5 (local build of `kuzzle`).
- Functional websocket suite on ES 9.5.5 with the packed driver (Docker path, `--tags "not @http and not @network"`):
  160 / 164 passed, 3 skipped; the one failure is `Websocket.feature:5`, the Docker path's known localhost limit.

