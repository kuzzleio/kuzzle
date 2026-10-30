---
code: false
type: page
order: 200
title: The StorageDriver contract | Write storage drivers | Guide
meta:
  - name: description
    content: The methods a Kuzzle storage driver implements
  - name: keywords
    content: Kuzzle, Documentation, storage driver, StorageDriver, contract, capabilities
---

# The StorageDriver Contract

<SinceBadge version="2.61.0" />

`kuzzle` exports the contract as TypeScript types: `StorageDriver` for an instance, `StorageDriverClass` for what the
package exports, and their parts (`StorageDriverCore`, `StorageUpdateByQuery`, `StorageMappingUpdates`,
`StorageStatsCapability`, `StorageEngineHooks`). They are the reference for every signature: the
[source](https://github.com/kuzzleio/kuzzle/blob/master/lib/types/storage/StorageDriver.ts) documents each method.
Declare your class with `implements StorageDriver` and the compiler checks it.

## Lifecycle

Kuzzle builds **two instances** of the class at startup, one per storage scope:

| Scope | `storeScopeEnum` | Holds |
| --- | --- | --- |
| public | `PUBLIC` | the application's indexes, those the API reaches |
| private | `PRIVATE` | Kuzzle's internal index (users, profiles, roles, API keys...) and the plugins' private storage |

```ts
new Driver(config: StorageEngineElasticsearch, scope: storeScopeEnum)
```

`config` is the whole `services.storageEngine` section. Then Kuzzle calls `init()` on each instance, under the
service init timeout (`services.storageEngine.initTimeout`): connect to the engine there. The two scopes must not see
each other's indexes: how the driver keeps them apart on the engine (a prefix, a database, a schema...) is up to it.

Kuzzle also calls the static `createNativeClient(clientConfig)` whenever an application or a plugin asks for the
engine's own client (`app.storage.storageClient`, `app.storage.StorageClient`, `context.constructors.ESClient`): it
returns a **new** client each time, built from `services.storageEngine.client`.

## The mandatory core

Every driver implements these methods. Indexes and collections are Kuzzle's names; documents are JSON objects with an
`_id`.

| Group | Methods |
| --- | --- |
| Engine | `init`, `info`, `translateKoncordeFilters` |
| Indexes | `createIndex`, `deleteIndex`, `deleteIndexes`, `getSchema` |
| Collections | `createCollection`, `deleteCollection`, `truncateCollection`, `refreshCollection`, `getMapping`, `getSettings` |
| One document | `get`, `exists`, `count`, `create`, `createOrReplace`, `update`, `upsert`, `replace`, `delete`, `deleteFields` |
| Several documents | `mGet`, `mExists`, `mCreate`, `mCreateOrReplace`, `mUpdate`, `mUpsert`, `mReplace`, `mDelete`, `import` |
| Search | `search`, `scroll`, `deleteByQuery`, `mExecute` |

A few rules hold across them:

- **Search bodies, mappings and settings are in the Elasticsearch format**, as the API receives them: the driver
  translates what it supports.
- **`translateKoncordeFilters`** turns [Koncorde filters](/core/2/api/koncorde-filters-syntax) into the driver's query
  language. An Elasticsearch-family driver uses `QueryTranslator`, which `kuzzle` exports.
- **Writes stamp `_kuzzle_info`** (`author`, `createdAt`, `updater`, `updatedAt`) from the `userId` option, unless
  `injectKuzzleMeta` is `false`, and honour `refresh` (`false`, `true` or `"wait_for"`).
- **The `m*` writes are partial**: a document that cannot be written goes in `errors`, the others are written.
- **`scroll`**: a search started with the `scroll` option answers a `scrollId`, which `scroll()` then pages through.
  Keep the cursor's state where every Kuzzle node reads it: the internal cache, through
  `global.kuzzle.ask("core:cache:internal:store" | "core:cache:internal:get" | "core:cache:internal:del", ...)`.

## Capabilities

The optional groups, declared in the manifest's `capabilities`:

| Capability | Methods or feature |
| --- | --- |
| `aggregations` | `aggregations` / `aggs` in a search body |
| `mappingUpdates` | `updateMapping`, `updateCollection` |
| `stats` | `stats` |
| `updateByQuery` | `updateByQuery`, `bulkUpdateByQuery` |

At startup, Kuzzle refuses a driver that declares a capability without its methods
([services.storage_driver.invalid_driver](/core/2/api/errors/error-codes/services)). Afterwards, it rejects a request
needing a capability the driver did not declare, before reaching the driver, with a
[services.storage_driver.unsupported_capability](/core/2/api/errors/error-codes/services) error. Declare only what the
driver fully implements: no silent approximation.

## Engine hooks

Optional methods Kuzzle calls when the driver has them, and skips otherwise:

| Hook | When Kuzzle calls it |
| --- | --- |
| `generateMissingAliases()` | at startup, when `services.storageEngine.generateMissingAliases` is set: repairs the engine-side naming of existing data |
| `waitForCollectionShards(index, collection, timeout?)` | before using a collection another node of the cluster has just created: waits, for a bounded time, until it can be written to |

## What a driver may use of Kuzzle

Inside its methods, a driver may use the running Kuzzle instance, `global.kuzzle`:

- `log` (prefer `log.child("...")`), `config`, `hash()`, `emit()`;
- the internal cache, through `ask("core:cache:internal:get" | "core:cache:internal:store" | "core:cache:internal:del")`;
- `withLock(key, callback)`, exported by `kuzzle`: a lock shared by every node of the cluster.

That is the set the [conformance kit](/core/2/guides/write-storage-drivers/testing) provides when it runs the driver
outside of Kuzzle: anything else is not available there.
