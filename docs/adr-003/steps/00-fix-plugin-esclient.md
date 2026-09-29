# Step 00 — Fix: `context.constructors.ESClient` ignores `majorVersion`

**Status:** 🟦 In progress · **Opened:** 2026-09-29 · **PR:** [#2947](https://github.com/kuzzleio/kuzzle/pull/2947) · Back to the [hub](../ADR-0003-storage-drivers.md)

## Goal

Found while writing the ADR: `PluginContextESClient` (`lib/core/plugin/pluginContext.ts`) called `Elasticsearch.buildClient(config)` without `services.storageEngine.majorVersion`, so `buildClient` fell back to `"7"` — plugins always got an Elasticsearch 7 client, even on an Elasticsearch 8 deployment. `app.storage.StorageClient` / `storageClient` already passed it. The maintainer chose to fix it now, ahead of step 02's delegation to the driver's native client.

## What was done

- `pluginContext.ts` passes `majorVersion` to `buildClient`.
- `tests/core/plugin/pluginContext.test.ts`: `ESClient` is an `sdk-es7` client for `"7"`, an `sdk-es8` one for `"8"`.
- Upgrade notes (`doc/2/guides/upgrade-notes/from-2-56/`): nothing changes on ES7; on ES8, plugins using this client check their calls against the 8.x client.

## Local decisions / gotchas

- A behaviour change for ES8 deployments whose plugins coped with the ES7 client — accepted as a bug fix, with an **Action** line in the upgrade notes.

## Validation

- Unit suite in Docker: 159 files, 3 915 tests passed. `pr-preflight`: lint, error-codes docs, ratchets & test type-check all OK.
