# Step 02 — ES7 / ES8 as thin internal drivers

**Status:** 🟦 In progress · **Opened:** 2026-10-29 · **PR:** [#3100](https://github.com/kuzzleio/kuzzle/pull/3100) · Back to the [hub](../ADR-0003-storage-drivers.md)

## Goal

The storage layer runs on the `StorageDriver` contract instead of the Elasticsearch classes: the built-in ES7 and ES8
classes become drivers, `ClientAdapter` holds a driver instance, and the raw client surfaces build their client
through the driver. An existing ES7 or ES8 stack sees no change; the ES7 / ES8 functional matrix is the safety net.

## What was done

- `lib/service/storage/builtInDrivers.ts`: `ES7Driver` / `ES8Driver` extend today's `ES7` / `ES8` classes, untouched,
  adding the two members of the contract they lacked — `init()` (their `_initSequence()`) and the static
  `createNativeClient(clientConfig)`. `builtInStorageDriver(majorVersion)` selects one;
  `createNativeStorageClient(config, clientConfig)` is what the raw client surfaces call.
- `lib/service/storage/storageService.ts`: `StorageService` runs one scope's driver instance under
  `services.storageEngine`'s init timeout (still named `elasticsearch` in the timeout error). It replaces the
  `Elasticsearch` facade (`lib/service/storage/Elasticsearch.ts`, removed), which picked the class by `majorVersion`.
- `ClientAdapter` (`lib/core/storage/clientAdapter.ts`) holds a `StorageService` and its `driver: StorageDriver`
  (formerly `es` and `client`); engine hooks it lacks are skipped (`?.()`), and a capability method it lacks raises
  `core.fatal.assertion_failed` until step 03's dedicated error.
- `app.storage.storageClient`, `app.storage.StorageClient` and `context.constructors.ESClient` build their client
  through the selected driver's `createNativeClient` — same behaviour, including the ES7 fallback when no
  `majorVersion` is set.
- Contract (`lib/types/storage/StorageDriver.ts`, unreleased since step 01): `getNativeClient()` removed from the
  instance; `StorageDriverClass<TNativeClient, TConfig>` gains the static `createNativeClient(clientConfig)` and
  types the configuration the driver reads.
- Tests: `tests/service/storage/builtInDrivers.test.ts`, `tests/service/storage/storageService.test.ts`, the
  optional-member cases in `tests/core/storage/clientAdapter.test.ts`; the shared ES7 / ES8 case harness now builds a
  `StorageService` over the built-in driver; `tests/core/storage/storageDriver.test.ts` and the typings consumer
  follow the contract change.

## Local decisions / gotchas

- **The raw client surfaces build a new client, they do not share the driver's** (maintainer, 2026-10-29). Today each
  surface connects on its own, before or after startup, and `StorageClient` takes config overrides: handing out the
  driver instance's client would change all three (and let a plugin close Kuzzle's own connection). Hence a static
  `createNativeClient(clientConfig)` on the driver class rather than an instance `getNativeClient()`.
- **The drivers subclass the built-in classes** rather than wrapping them: the thinnest adapter, and every existing
  ES7 / ES8 unit case keeps driving the same object.
- **`StorageDriverClass` is generic on the configuration** (`TConfig extends JSONObject`, default `JSONObject`): the
  built-in classes take `StorageEngineElasticsearch`, which a plain `JSONObject` constructor parameter would refuse
  without a cast.

## Validation

- `npm run build`, `npm run typecheck:typings`, `npm run typecheck:tests`, `npm run test:lint`: OK.
- Unit suite: 170 files, 4 493 tests passed.
- Functional, websocket profile, Docker path (`.ci/scripts/docker-test.sh`, `--tags "not @http and not @network"`):
  ES7 160 / 164 scenarios passed, ES8 162 / 164, the rest skipped by the suite. The one failure on each, and the
  scenarios left out, reach Kuzzle on `localhost` (`Websocket.feature`, `Network.feature`), which only answers when
  cucumber runs on the host, as in CI: an environment limit of the Docker path, the same with or without this step.
