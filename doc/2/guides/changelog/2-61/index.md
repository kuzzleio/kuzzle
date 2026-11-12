---
code: false
type: page
order: 390
title: Kuzzle 2.61 | Changelog | Guide | Core
meta:
  - name: description
    content: What Kuzzle 2.61 changes, in plain words
  - name: keywords
    content: Kuzzle, Documentation, changelog, 2.61, storage, drivers, Elasticsearch, OpenSearch
---

# Kuzzle 2.61

**Released:** [2.61.0](https://github.com/kuzzleio/kuzzle/releases/tag/v2.61.0) on 2026-11-04, after nine betas (2.61.0-beta.1 on 2026-10-30 to 2.61.0-beta.9). 2.61.1 is in beta since 2026-11-12.

The [GitHub release notes](https://github.com/kuzzleio/kuzzle/releases) list every commit. This page tells you what changes for you. For what to check before you upgrade, read [Upgrading from 2.60](/core/2/guides/upgrade-notes/from-2-60).

## 2.61.1

**Status:** in beta since 2026-11-12 (2.61.1-beta.1).

Three fixes, for clusters, Valkey and the startup of the storage. No new feature, no configuration change.

- **What you need to do:** nothing. If a monitoring tool reads the cache version in [`server:info`](/core/2/api/controllers/server/info) on Valkey, it now gets Valkey's own version (see the [upgrade notes](/core/2/guides/upgrade-notes/from-2-60#_2-61-1)).
- **Fixed: a node whose Redis stops answering leaves the cluster within seconds.** When Redis stopped answering without closing the connection (a network policy or a partition dropping packets, a failover that does not reset connections), a node took about 10 minutes to notice, while its cluster registration had expired after 4 seconds. Meanwhile `/_healthcheck` answered `200` and every request touching Redis hung. The node now gives up on a heartbeat Redis has not answered within `cluster.heartbeat` (2 seconds by default), leaves the cluster and exits with code `1`, so that your orchestrator restarts it ([#3181](https://github.com/kuzzleio/kuzzle/issues/3181)).
- **Fixed: the storage engine no longer fails silently at startup** (built-in drivers 1.1.1). With a certificate the driver does not trust, a host name missing from the certificate or a wrong password, Kuzzle stayed on `Trying to connect to Elasticsearch...` until the init timeout (2 minutes by default), then stopped with a generic [`core.fatal.service_timeout`](/core/2/api/errors/error-codes/core) error, with nothing in its logs telling why. It now logs why the engine does not answer yet, as a warning, and stops at once, with a [`services.storage.unexpected_error`](/core/2/api/errors/error-codes/services) error naming the cause, on a TLS failure or refused credentials (401, 403). A cluster that is not up yet is still waited for. The external drivers carry the same fix: `kuzzle-storage-es-9` 1.1.1, `kuzzle-storage-opensearch-2` and `kuzzle-storage-opensearch-3` 1.0.1 ([storage-es-8#9](https://github.com/kuzzleio/storage-es-8/issues/9)).
- **Fixed: [`server:info`](/core/2/api/controllers/server/info) on Valkey** gave every Valkey server the version `7.2.4`, the Redis version Valkey announces for compatibility, and an empty mode on Valkey 9. It now gives Valkey's own version and mode, and a new `server` field tells which server answers (`redis` or `valkey`). [`server:capabilities`](/core/2/api/controllers/server/capabilities) gives the real version too.
- **New in the docs:** a [compatibility matrix](/core/2/guides/compatibility): the Node.js versions, systems, storage engines and cache servers (Redis 6.2 or later, Valkey 7.2 or later) Kuzzle runs on, and which ones the CI tests.
- **Under the hood:** `kuzzle-storage-es-7` and `kuzzle-storage-es-8` 1.1.1.

## 2.61.0

### In short

2.61 opens Kuzzle to other storage engines. A storage engine can now come as a separate npm package, a _storage driver_, that you install next to Kuzzle and name in the configuration. Elasticsearch 7 and 8 keep working exactly as before: they are now Kuzzle's built-in drivers, shipped as packages Kuzzle installs with itself.

### What you need to do

Nothing. An Elasticsearch 7 or 8 setup needs no change, in its configuration or its dependencies.

Before you move to another storage engine, check your plugins and your application: with a driver set, `majorVersion` no longer tells which client `app.storage.storageClient` or `context.constructors.ESClient` gives. Ask Kuzzle with `app.storage.getEngine()` or `context.accessors.getStorageEngine()` instead (see [Upgrading from 2.60](/core/2/guides/upgrade-notes/from-2-60#raw-storage-clients)).

If your code or your clients match the text of storage error messages, check it: they no longer say "Elasticsearch" (see [Upgrading from 2.60](/core/2/guides/upgrade-notes/from-2-60#storage-error-messages)).

### What's new

- **Storage drivers.** Set `services.storageEngine.driver` to the name of a driver package to run Kuzzle on another storage engine. Kuzzle checks the driver at startup and refuses to start if it is missing, invalid or not made for this Kuzzle version. The API does not change: queries and mappings are still written in the Elasticsearch format. Read [Storage Drivers](/core/2/guides/main-concepts/data-storage#storage-drivers).
- **Capabilities.** A driver may not support every feature (aggregations, mapping changes, statistics, update by query). A request needing one it does not support is rejected with a clear [`services.storage_driver.unsupported_capability`](/core/2/api/errors/error-codes/services) error. The built-in drivers support them all.
- **Same driver on every cluster node.** A node running another driver, or another version of it, than the rest of the cluster is refused when it joins, with a [`cluster.join.storage_driver_mismatch`](/core/2/api/errors/error-codes/cluster) error. Nodes running the built-in Elasticsearch drivers are compared by Elasticsearch major version only: a `majorVersion: "8"` node is refused by `"7"` nodes, and a rolling upgrade from 2.60 with an unchanged configuration still works. A refused node is refused before it connects to the storage, so it writes nothing there ([#3139](https://github.com/kuzzleio/kuzzle/issues/3139)).
- **Elasticsearch 7 and 8 as packages** (2.61.0-beta.2). The built-in drivers now live in their own packages, [`kuzzle-storage-es-7`](https://www.npmjs.com/package/kuzzle-storage-es-7) and [`kuzzle-storage-es-8`](https://www.npmjs.com/package/kuzzle-storage-es-8), which Kuzzle depends on and installs with itself: same code, same behavior, still selected by `majorVersion`. Your `package.json` does not change.
- **Elasticsearch 9.** Install the driver [`kuzzle-storage-es-9`](https://www.npmjs.com/package/kuzzle-storage-es-9) next to Kuzzle and set `services.storageEngine.driver` to `"kuzzle-storage-es-9"`. It is Kuzzle's Elasticsearch 8 driver on the Elasticsearch 9 client: same mappings, same queries, same errors.
- **OpenSearch 2 and 3** (2.61.0-beta.5). Install [`kuzzle-storage-opensearch-2`](https://www.npmjs.com/package/kuzzle-storage-opensearch-2) (OpenSearch 2.19 and later 2.x) or [`kuzzle-storage-opensearch-3`](https://www.npmjs.com/package/kuzzle-storage-opensearch-3) (OpenSearch 3) next to Kuzzle and name it in `services.storageEngine.driver`. Both are Kuzzle's Elasticsearch 7 driver on the OpenSearch client: same mappings, same queries, same errors. They do not move your data: copy it from Elasticsearch with a snapshot or a remote reindex.
- **`majorVersion` is deprecated**, in the documentation only: it keeps working unchanged in Kuzzle 2, and Kuzzle 3 will select the storage engine with `driver` alone. Kuzzle warns at startup only if your configuration sets both `driver` and `majorVersion`, since `majorVersion` is then ignored.
- **Clearer storage driver errors.** A missing driver says how to install it, without Node's whole `Require stack`; an installed package that is not a usable driver (such as a name-reservation placeholder) says so; `majorVersion: "9"` without a driver stops Kuzzle with [`services.storage_driver.unsupported_major_version`](/core/2/api/errors/error-codes/services), which points to `services.storageEngine.driver`; the startup log names the directory the driver was loaded from ([#3134](https://github.com/kuzzleio/kuzzle/issues/3134)).
- **Driver names.** `services.storageEngine.driver` accepts an npm alias, and a driver installed with `npm link` or from a directory now works. A path is refused, with a hint to install the package and name it ([#3142](https://github.com/kuzzleio/kuzzle/issues/3142)).
- **Which storage engine Kuzzle runs on** (2.61.0-beta.6). Plugins and applications can ask it with [`context.accessors.getStorageEngine()`](/core/2/framework/classes/plugin-context-accessors/get-storage-engine) or [`app.storage.getEngine()`](/core/2/framework/classes/backend-storage/get-engine): the driver package, the engine family (`elasticsearch`, `opensearch`) and the engine server's version. Use it instead of guessing the engine from `majorVersion` ([#3133](https://github.com/kuzzleio/kuzzle/issues/3133)).
- **Storage connections closed on shutdown** (2.61.0-beta.6). A driver can implement an optional `close()` hook, which Kuzzle calls on a graceful shutdown to release its engine connections; every official driver does. If it fails, Kuzzle logs a warning and carries on shutting down ([#3141](https://github.com/kuzzleio/kuzzle/issues/3141)). Since 2.61.0-beta.7, Kuzzle also waits for the requests plugins are running before closing the storage: in 2.61.0-beta.6, stopping Kuzzle right after it started could make it exit with code 1, in development mode, when a plugin was still working at startup ([#3160](https://github.com/kuzzleio/kuzzle/issues/3160)).
- **Engine-neutral messages** (2.61.0-beta.6). Storage error messages and logs say "storage engine" instead of "Elasticsearch", which was wrong on OpenSearch. Error ids and codes do not change ([#3143](https://github.com/kuzzleio/kuzzle/issues/3143)).
- **For driver authors.** `kuzzle` exports what a driver needs: the `StorageDriver` contract and its types, a conformance kit (`describeStorageDriverConformance`) that tests a driver against its real engine, and `storageError`, so that a driver returns the same errors as Kuzzle. Read the new [Write storage drivers](/core/2/guides/write-storage-drivers/start-writing-storage-drivers) guide.
- **Drivers documentation.** Each official driver has its own documentation (install, configuration, TypeScript, compatibility, troubleshooting) in the new [Drivers](/drivers/v2.html) section.

### What's fixed

- A node joining a cluster could still list an index or a collection that another node had deleted before it joined, and keep a collection lock that was already released. It now replaces its cache with what the storage holds when it loads it.
- In a cluster, a request served by one node right after another node created an index or a collection could fail with [`services.storage.unknown_index`](/core/2/api/errors/error-codes/services) or [`unknown_collection`](/core/2/api/errors/error-codes/services), or not see it in a list, for a few milliseconds. Likewise, creating an index another node had just deleted could fail with `index_already_exists`. A node now checks the storage before answering so. Those checks start at most once every `services.storageEngine.cacheMissReadInterval` (default 100 ms, `0` to check on every miss), so a request on a missing index or collection can fail up to 100 ms later ([#3140](https://github.com/kuzzleio/kuzzle/issues/3140)).
- If the `kuzzle-storage-es-7` or `kuzzle-storage-es-8` package was missing from `node_modules`, Kuzzle stopped with a raw `Cannot find module` error (2.61.0-beta.2). It now stops with the documented [`services.storage_driver.not_found`](/core/2/api/errors/error-codes/services) error, as for an external driver (2.61.0-beta.3).
- An external driver could load another copy of `kuzzle` than the running one, when Kuzzle runs as its own application, as in the official Docker image: some documented `404` or `400` errors then came back as `500` `unexpected_error`. A driver now always uses the Kuzzle that loads it ([#3132](https://github.com/kuzzleio/kuzzle/issues/3132)).
- Some storage engine errors reached clients as [`services.storage.unexpected_bad_request`](/core/2/api/errors/error-codes/services) or `unexpected_error` instead of their documented code, since before 2.61: the error mapping expected messages the current engine clients no longer produce. With every official driver, they now come back as `too_many_operations` (thread pool or indexing pressure rejection), `cannot_change_mapping`, `unexpected_properties`, `invalid_mapping_type`, `too_many_changes` (version conflict) and `unknown_query_keyword`.
- A driver now refuses to start on an engine it does not support: an Elasticsearch driver on another Elasticsearch major (e.g. `kuzzle-storage-es-7` on an 8.x cluster) or on OpenSearch, which reports itself as Elasticsearch 7.10.2. The OpenSearch drivers name OpenSearch, not Elasticsearch, in their logs and messages.
- A driver missing a method of the storage contract started, then failed with a `500` on the first request using it. Kuzzle now refuses it at startup with [`services.storage_driver.invalid_driver`](/core/2/api/errors/error-codes/services) ([#3137](https://github.com/kuzzleio/kuzzle/issues/3137)).
- An unhandled rejection whose reason is not an `Error` was logged as `ERROR: unhandledRejection: [object Object]`, or `[object Promise]` with no reason at all. The log now shows the reason's content, or the promise's (2.61.0-beta.9).

### Under the hood

- `kuzzle` depends on `kuzzle-storage-es-7` and `kuzzle-storage-es-8` at pinned versions: a new version of a built-in driver reaches you with a Kuzzle release.
- All five official drivers have stable releases (2.61.0-beta.8): `npm install kuzzle-storage-es-9`, `kuzzle-storage-opensearch-2` or `kuzzle-storage-opensearch-3` installs a release, no beta tag needed, and Kuzzle's built-in drivers are their stable releases too.
- Dependency updates (2.61.0-beta.6): `lodash` 4.18.1 (security fixes: prototype pollution in `_.unset` / `_.omit`, injection in `_.template` imports), `uuid` 14, `zeromq` 6.8.0, and patch or minor updates of `eventemitter3`, `moment`, `pino-pretty`, `semver`, `validator` and `yargs`. No change in behavior.
