# Step 05 — The first external driver: Elasticsearch 9

**Status:** 🟦 In progress · **Opened:** 2026-10-30 · **PR:** — · Back to the [hub](../ADR-0003-storage-drivers.md)

## Goal

Elasticsearch 9 runs under Kuzzle 2 through an external driver, `@kuzzleio/storage-es-9`, in its own repository: the
first driver written against the contract, the loader and the conformance kit of steps 01–04, outside the core.
Kuzzle's functional matrix runs on it, and `majorVersion` is deprecated (doc + startup notice). An ES7 / ES8 stack
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
| A | What a driver needs from `kuzzle` and cannot copy: `storageError` (the `services.storage.*` errors); `kuzzle` beta carrying it and the conformance kit | kuzzle | 🟦 |
| B | The driver: ES8 code adapted to the ES9 client, manifest, conformance kit in its CI on ES9, `1.0.0-beta.1` | storage-es-9 | ⬜ |
| C | Kuzzle's functional matrix on ES9 with the published driver; `majorVersion` deprecated (doc + startup notice); docs | kuzzle | ⬜ |

## What was done

- Part A: `storageError` (`lib/core/storage/storageError.ts`) exported by `kuzzle`, `kerror.wrap("services",
  "storage")`: a driver throws Kuzzle's storage errors (class, status, documented message) with no deep import.
  Unit test and typings gate (`tests/typings/consumer/storageDriver.ts`).

## Local decisions / gotchas

- **What the ES8 driver imports from Kuzzle's internals**: only `services.storage.*` errors need an export (their
  catalogue lives in `kuzzle`); `QueryTranslator`, `withLock`, `storeScopeEnum`, the error classes are already
  exported, and the small helpers (`didYouMean`, `extractFields`, `assertIsObject`, `isPlainObject`, `debug`) are
  copied into the driver.
- **The driver repository needs a `kuzzle` release** carrying the kit and `storageError`: `2.61.0-beta.1`, cut from
  `2-dev` once part A is merged. Until then the driver is developed against a local build of `kuzzle`.

## Validation

