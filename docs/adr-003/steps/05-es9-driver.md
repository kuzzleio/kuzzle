# Step 05 — The first external driver: Elasticsearch 9

**Status:** ✅ Done 2026-10-30 · **Opened:** 2026-10-30 · **PRs:** [#3103](https://github.com/kuzzleio/kuzzle/pull/3103) (part A), [#3108](https://github.com/kuzzleio/kuzzle/pull/3108) (unscoped name), [#3109](https://github.com/kuzzleio/kuzzle/pull/3109) (part C) · Frozen · Back to the [hub](../ADR-0003-storage-drivers.md)

## Goal

Elasticsearch 9 runs under Kuzzle 2 through an external driver, `kuzzle-storage-es-9`, in its own repository: the
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
| A | What a driver needs from `kuzzle` and cannot copy: `storageError` (the `services.storage.*` errors); `kuzzle` beta carrying it and the conformance kit | kuzzle | ✅ #3103 merged; `2.61.0-beta.1` published 2026-10-30 |
| B | The driver: ES8 code adapted to the ES9 client, manifest, conformance kit in its CI on ES9, `1.0.0-beta.1` | storage-es-9 | ✅ `kuzzle-storage-es-9@1.0.0-beta.1` published 2026-10-30; repo pushed, CI green on ES 9.0.8 / 9.5.5 |
| C | Kuzzle's functional matrix on ES9 with the published driver; `majorVersion` deprecated (doc); warning when `driver` and `majorVersion` are both set; docs | kuzzle | ✅ #3109 merged 2026-10-30 |

- **No startup deprecation notice for `majorVersion` in v2** (maintainer, 2026-10-30): an ES7 / ES8 stack has nothing
  else to use in v2, so the notice would show at every start with no action possible. Kuzzle warns only when `driver`
  and `majorVersion` are both set (`majorVersion` is then ignored); the rest goes in the documentation.

## What was done

- Part A: `storageError` (`lib/core/storage/storageError.ts`) exported by `kuzzle`, `kerror.wrap("services",
  "storage")`: a driver throws Kuzzle's storage errors (class, status, documented message) with no deep import.
  Unit test and typings gate (`tests/typings/consumer/storageDriver.ts`).
- Part C, ahead of the CI job: `ES_VERSION=8 STORAGE_DRIVER=es9 .ci/scripts/docker-test.sh functional <suite>` runs the
  cluster on Elasticsearch 9 with the driver installed by `.ci/scripts/stage-es9-driver.sh` (npm spec, default
  `kuzzle-storage-es-9@beta`, or `ES9_DRIVER=<.tgz>`), overlay `.ci/test-cluster-es9-driver.yml`.
- Part B: the ES8 classes copied, imports moved to `kuzzle`'s exports and the ES9 client; only fix the client needed:
  `indices.updateAliases` takes `actions` at the top level. Published as `kuzzle-storage-es-9` (see gotchas); releases
  by semantic-release (`semantic-release-config-kuzzle` 1.8.0, `master` stable / `beta` prerelease, npm trusted
  publishing), the first beta published by hand and tagged. PRs target `beta`: a merge into `master` with no stable
  release yet would publish `1.0.0`.
- Part C: CI job `functional-tests-es9-driver` (the five suites, Node 24) through `run-test-cluster.sh`
  `STORAGE_DRIVER=es9` (driver staged from npm `beta`). `majorVersion` deprecated in the docs (data storage guide,
  ES8 guide, Kuzzle 3 page, `.kuzzlerc.sample.jsonc`), no `@deprecated` tag (same reason as the notice). The warning:
  `loadConfig` drops the packaged `majorVersion` before `rc` merges, so a user's value shows; set along with `driver`, it
  lands in `internal.ignoredSettings`, which `StorageEngine` logs as a warning (the `deprecatedSettings` pattern).

## Local decisions / gotchas

- **The package is `kuzzle-storage-es-9`, unscoped** (2026-10-30): the first `npm publish` of `@kuzzleio/storage-es-9`
  failed with a 404, the maintainer's account cannot publish under `@kuzzleio` on npmjs, the scope the private registry
  (`packages.paas.kuzzle.io`) uses. Kuzzle's public packages are unscoped (`kuzzle`, `kuzzle-sdk`, `kuzzle-types`).

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
- Part C in CI ([#3109](https://github.com/kuzzleio/kuzzle/pull/3109)): `functional-tests-es9-driver` green on the five
  suites with `kuzzle-storage-es-9@beta` from npm; the ES7 / ES8 matrix green and unchanged.
- Left after the freeze, outside this repository: merge `kuzzleio/storage-es-9#1` (manual release trigger) into `beta`.
