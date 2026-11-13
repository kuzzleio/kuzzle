---
code: false
type: page
order: 50
title: Upgrading from 2.60 | Upgrade notes | Guide | Core
meta:
  - name: description
    content: What you can observe when you upgrade Kuzzle from v2.60 to v2.61, and what to check
  - name: keywords
    content: Kuzzle, Documentation, upgrade, 2.61, storage, drivers, release notes
---

# Upgrading from 2.60

This page covers Kuzzle **2.61**, starting with its first beta, 2.61.0-beta.1 (2.61.0-beta.2 adds the built-in drivers as packages, 2.61.0-beta.3 pins them to `1.0.0`, 2.61.0-beta.4 fixes the index and collection checks in a cluster, 2.61.0-beta.5 documents the OpenSearch 2 and 3 drivers, 2.61.0-beta.6 tells plugins which engine runs, closes the storage connections on shutdown and words storage messages for any engine, 2.61.0-beta.7 waits for plugin requests before closing the storage, 2.61.0-beta.8 moves to the drivers' stable releases, 2.61.0-beta.9 logs what an unhandled rejection contains). 2.61.0 is the content of 2.61.0-beta.9. The [2.61.1](#_2-61-1) and [2.61.2](#_2-61-2) patches are at the end of this page. If you upgrade from an older version, read the [previous upgrade notes](/core/2/guides/upgrade-notes/from-2-59) too.

The API, the configuration and the TypeScript declarations stay compatible with v2.60.1. An Elasticsearch 7 or 8 setup needs no change. Items that may need an action on your side are marked **Action**.

The changelog is generated from the commits and says what was done. This page says what you may have to check.

## Operators

### Elasticsearch 7 and 8 run as built-in storage drivers

Kuzzle now talks to its database through a [storage driver](/core/2/guides/main-concepts/data-storage#storage-drivers). Elasticsearch 7 and 8 are its built-in drivers, still selected by `services.storageEngine.majorVersion`: their behavior and their configuration do not change.

Since 2.61.0-beta.2, their code lives in two packages, [`kuzzle-storage-es-7`](/drivers/storage-es-7/1/) and [`kuzzle-storage-es-8`](/drivers/storage-es-8/1/), which `kuzzle` depends on at pinned versions. `npm install` brings them with Kuzzle: there is nothing to add to your `package.json`. `npm ls kuzzle-storage-es-8` shows the version your Kuzzle uses.

Since 2.61.0-beta.3, both are pinned to stable versions. If the package of the configured `majorVersion` is missing (a partial install, a pruned `node_modules`), Kuzzle does not start and reports [`services.storage_driver.not_found`](/core/2/api/errors/error-codes/services). **Action**, only if you see it: run `npm install` again.

A rolling upgrade from v2.60 with an unchanged configuration works as before: nodes running the built-in drivers are compared by Elasticsearch major version only, and a node older than 2.61 counts as a built-in one. **Action**, only if your cluster mixes `majorVersion` values: align them. A `majorVersion: "8"` node is now refused by `"7"` nodes, with [`cluster.join.storage_driver_mismatch`](/core/2/api/errors/error-codes/cluster) ([#3139](https://github.com/kuzzleio/kuzzle/issues/3139)). Such a cluster was splitting its data across two Elasticsearch clusters.

### Running another storage engine

Setting `services.storageEngine.driver` to the name of a driver package, installed next to `kuzzle`, runs Kuzzle on that driver's engine. `driver` takes an npm package name or an npm alias, not a path; a driver installed with `npm link` or from a directory works too. In that case:

- `services.storageEngine.majorVersion` is ignored, and the rest of `services.storageEngine` is handed to the driver. If your configuration sets `majorVersion` too, Kuzzle logs `services.storageEngine.majorVersion is ignored because services.storageEngine.driver is set: remove majorVersion.` at startup;
- Kuzzle logs `[ℹ] Storage driver: <name>@<version> (<directory>)` at startup, instead of the Elasticsearch major version;
- Kuzzle does not start when the driver is missing, when its `manifest.json` is invalid, when its `kuzzleVersion` range excludes this Kuzzle version, or when it lacks a method of the storage contract or of a capability it declares (the [`services.storage_driver.*`](/core/2/api/errors/error-codes/services) errors). These messages say what to do, for instance how to install a missing package ([#3134](https://github.com/kuzzleio/kuzzle/issues/3134), [#3137](https://github.com/kuzzleio/kuzzle/issues/3137));
- the driver always uses the running Kuzzle, even when another copy of `kuzzle` sits in `node_modules`, as in the official Docker image ([#3132](https://github.com/kuzzleio/kuzzle/issues/3132)). Before, such a driver could answer some documented `404` or `400` errors as `500` `unexpected_error`;
- a request needing a capability the driver does not declare is rejected with [`services.storage_driver.unsupported_capability`](/core/2/api/errors/error-codes/services) (400).

**Action**, only if you use an external driver in a cluster: every node must run the same driver in the same version. A node running another one fails its startup with [`cluster.join.storage_driver_mismatch`](/core/2/api/errors/error-codes/cluster), before it connects to the storage. A node running an external driver also refuses to start next to a node older than 2.61. If the mismatching node may be a stale one (killed without cleaning up, as in a full restart), the starting node logs a warning and waits for its ID card to expire (about 6 seconds by default) before deciding. Upgrading a driver therefore means restarting every node on the new version, not a rolling restart.

### Engine version checked by the driver

Each official driver now refuses to start on an engine it does not support: the built-in Elasticsearch 7 driver on an Elasticsearch 8 cluster, for instance, or an Elasticsearch driver on OpenSearch (which reports itself as Elasticsearch 7.10.2). **Action**, only if Kuzzle no longer starts: point it at the engine its `majorVersion` or `driver` names, or pick the matching driver.

### Running Elasticsearch 9 or OpenSearch

Install the driver next to `kuzzle` and name it in `services.storageEngine.driver`:

| Engine                        | Driver                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| Elasticsearch 9               | [`kuzzle-storage-es-9`](https://www.npmjs.com/package/kuzzle-storage-es-9)                 |
| OpenSearch 2.19 and later 2.x | [`kuzzle-storage-opensearch-2`](https://www.npmjs.com/package/kuzzle-storage-opensearch-2) |
| OpenSearch 3                  | [`kuzzle-storage-opensearch-3`](https://www.npmjs.com/package/kuzzle-storage-opensearch-3) |

Unlike the built-in drivers, Kuzzle does not pin these: you choose their version in your `package.json`. Check your plugins first (see [Raw storage clients](#raw-storage-clients)).

**Action**, to move from Elasticsearch 8 to Elasticsearch 9:

1. upgrade the Elasticsearch cluster to 9, following Elastic's upgrade guide;
2. `npm install kuzzle-storage-es-9` in your application;
3. set `services.storageEngine.driver` to `"kuzzle-storage-es-9"` and remove `majorVersion`;
4. stop every Kuzzle node, then start them all on the new configuration. A rolling restart does not work: a node running `kuzzle-storage-es-9` is refused by nodes still running the built-in driver ([`cluster.join.storage_driver_mismatch`](/core/2/api/errors/error-codes/cluster)).

The OpenSearch drivers do not move your data: copy it from Elasticsearch with a snapshot or a remote reindex.

### `majorVersion` is deprecated

`services.storageEngine.majorVersion` is deprecated in the documentation: Kuzzle 3 will select the storage engine with `driver` alone. It keeps working unchanged in Kuzzle 2, where it still chooses between the built-in Elasticsearch 7 and 8 drivers, and Kuzzle logs no deprecation warning for it.

Without `driver`, a `majorVersion` other than `"7"` or `"8"`, such as `"9"`, stops Kuzzle with [`services.storage_driver.unsupported_major_version`](/core/2/api/errors/error-codes/services), which points to `driver` ([#3134](https://github.com/kuzzleio/kuzzle/issues/3134)). Kuzzle 2.60 already refused it, with a plain error.

### Index cache of a joining node

A node joining a cluster could keep, in its cache, an index or a collection that another node had deleted before it joined, and a collection write lock already released: the deletion was announced to the nodes already in the cluster only. When it loads its cache, a node now replaces it with what the storage holds.

### Index and collection checks in a cluster

Each node keeps the list of indexes and collections in memory, and learns about the ones another node creates or deletes through a cluster message that no request waits for. For a few milliseconds after a creation on one node, another node could answer that the index or the collection does not exist (`services.storage.unknown_index`, `unknown_collection`), leave it out of `index:list` or `collection:list`, or refuse to create an index another node had just deleted (`index_already_exists`).

A node now checks the storage before giving such an answer, and updates its list. As a result, `index:list`, `collection:list` and `index:stats` read the storage on every call, and a request on an index or a collection that does not exist costs one storage read before it fails. Requests on existing indexes and collections are unchanged.

These storage reads start at most once every `services.storageEngine.cacheMissReadInterval` milliseconds (default `100`) on each node ([#3140](https://github.com/kuzzleio/kuzzle/issues/3140)): a client looping on a missing index no longer costs one read per request. A miss inside the interval waits for the next read and shares it, so the answer is never stale, and any index or collection created or deleted lifts the wait. As a result, a request on an index or a collection that does not exist can fail up to 100 ms later. **Action**, only if that delay matters to you: set `cacheMissReadInterval` to `0` to read on every miss, as in 2.61.0-beta.4.

## Plugin and application developers

### Raw storage clients

`app.storage.storageClient`, `app.storage.StorageClient` and `context.constructors.ESClient` are now built by the storage driver. With the built-in drivers, they give the same Elasticsearch client as before, in the same version and with the same API. With an external driver, they give that driver's engine client.

::: warning
With `services.storageEngine.driver` set, `services.storageEngine.majorVersion` is ignored, yet still holds a value: `"7"` by default. Code choosing the client's API from it (`majorVersion === "8" ? … : …`) picks the Elasticsearch 7 API, wrong for `kuzzle-storage-es-9`. The client's API follows the driver:

| Driver                                                                                 | Client API                                                                 |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| built-in Elasticsearch 7, `kuzzle-storage-opensearch-2`, `kuzzle-storage-opensearch-3` | Elasticsearch 7 shape: `body` in requests, responses wrapped in `{ body }` |
| built-in Elasticsearch 8, `kuzzle-storage-es-9`                                        | Elasticsearch 8 shape: `document` in requests, flat responses              |

**Action**, for plugin and application authors, before running on an external driver: do not infer the client's API from `majorVersion`. Since 2.61.0-beta.6, ask Kuzzle which driver and engine run with [`app.storage.getEngine()`](/core/2/framework/classes/backend-storage/get-engine) or [`context.accessors.getStorageEngine()`](/core/2/framework/classes/plugin-context-accessors/get-storage-engine): its `driver` tells the client's API, its `engine` the engine family (`elasticsearch`, `opensearch`).
:::

Since 2.61.0-beta.2, that client comes from the driver package's own copy of `@elastic/elasticsearch`. **Action**, only if your code checks it with `instanceof` against a `Client` class it imports itself: compare its behavior instead, or import the class from the driver's dependencies. To type it, see the drivers' [TypeScript](/drivers/storage-es-8/1/typescript/) page.

### Storage error codes

Since before 2.61, some storage engine errors reached clients as [`services.storage.unexpected_bad_request`](/core/2/api/errors/error-codes/services) or `unexpected_error`: the error mapping expected messages the current engine clients no longer produce. With 2.61 and every official driver, they come back with their documented [`services.storage.*`](/core/2/api/errors/error-codes/services) code: `too_many_operations` (thread pool or indexing pressure rejection), `cannot_change_mapping`, `unexpected_properties`, `invalid_mapping_type`, `too_many_changes` (version conflict) and `unknown_query_keyword`.

**Action**, only if your code or your clients match on `unexpected_bad_request` or `unexpected_error` for these cases: match the specific code instead.

### Storage error messages

Since 2.61.0-beta.6, storage error messages say "storage engine" instead of "Elasticsearch", also right on OpenSearch ([#3143](https://github.com/kuzzleio/kuzzle/issues/3143)). For instance, `services.storage.not_connected` now reads "Storage engine is not connected.", `services.storage.version_mismatch` "Your storage engine version is …", and the Koncorde and Query DSL keyword errors name "the storage engine Query DSL". A storage initialization timeout now names the service `storageEngine` instead of `elasticsearch` in `core.fatal.service_timeout`. Error ids, codes and statuses do not change.

**Action**, only if your code, your clients or your log alerts match the text of these messages: match the error id instead.

### Storage drivers close their connections on shutdown

Since 2.61.0-beta.6, Kuzzle calls the storage driver's optional `close()` hook on a graceful shutdown, and every official driver closes its engine connections there. A driver whose `close()` fails gets a warning in the logs, and the shutdown carries on. Before closing the storage, the shutdown waits for the client requests still running and, since 2.61.0-beta.7, for the requests plugins run through `context.accessors.sdk` or `app.sdk` too ([#3160](https://github.com/kuzzleio/kuzzle/issues/3160)). That wait lasts 5 seconds at most, as a plugin may run requests in a loop: past it, Kuzzle logs a warning and closes the storage anyway. An unhandled rejection that happens while Kuzzle shuts down is logged and no longer stops it with exit code 1 in development mode: late plugin work failing on the closed storage does not turn a requested shutdown into a failure. Driver authors: see the [storage driver contract](/core/2/guides/write-storage-drivers/contract).

### New exports

`kuzzle` now exports the `StorageDriver` contract and its types, the conformance kit `describeStorageDriverConformance`, and `storageError`, which builds Kuzzle's `services.storage.*` errors. They are meant for driver authors: see the [Write storage drivers](/core/2/guides/write-storage-drivers/start-writing-storage-drivers) guide.

## 2.61.1

Three fixes. Nothing to change in your configuration.

### A node whose Redis stops answering leaves the cluster

Each cluster node renews its registration in Redis every `cluster.heartbeat` milliseconds (2 seconds by default). A renewal Redis has not answered within that delay now fails: the node leaves the cluster, shuts down and exits with code `1`. It used to wait until the operating system gave up on the connection, about 10 minutes when Redis stopped answering without closing it (packets dropped by a network policy or a partition, a failover that does not reset connections), while `/_healthcheck` kept answering `200` and every request touching Redis hung ([#3181](https://github.com/kuzzleio/kuzzle/issues/3181)). On its way out, the node also stops waiting on Redis to delete its registration (after `cluster.heartbeat`) and to free the locks it holds (after 2 seconds, on any shutdown): what it could not delete expires on its own. Requests still waiting on Redis keep the node up until the 30-second limit of a failure shutdown.

**Action:** none if your orchestrator restarts a node that exits on failure (see [Startup failures](/core/2/guides/advanced/cluster-scalability#startup-failures)). A Redis that is alive but answers slower than `cluster.heartbeat` now makes nodes leave the cluster: its registration would have expired anyway, and the other nodes would have evicted it.

### Storage engine errors at startup

The built-in drivers `kuzzle-storage-es-7` and `kuzzle-storage-es-8` move to 1.1.1. While Kuzzle waits for the storage engine at startup, they log why it does not answer yet, as a warning (`[⚠] Elasticsearch is not reachable yet: <reason>`), when the reason changes and every 30 attempts. A TLS failure (untrusted or expired certificate, host name missing from the certificate) or credentials the engine refuses (401, 403) stop the startup at once with a [`services.storage.unexpected_error`](/core/2/api/errors/error-codes/services) error naming the cause, so the node exits with code `1` right away, instead of after `services.storageEngine.initTimeout` (2 minutes by default) with a generic `core.fatal.service_timeout` error and no clue in the logs. A refused connection, a timeout or a `503` are still retried until `services.storageEngine.initTimeout`.

**Action:** if you run `kuzzle-storage-es-9`, `kuzzle-storage-opensearch-2` or `kuzzle-storage-opensearch-3`, upgrade it (1.1.1, 1.0.1 and 1.0.1) to get the same behavior. If a deployment used to start late because the engine's certificate or credentials were provisioned after Kuzzle, it now fails, and is restarted, until they are in place.

### Valkey in `server:info`

[`server:info`](/core/2/api/controllers/server/info) describes Valkey with its own version and mode, instead of `7.2.4` (the Redis version Valkey announces for compatibility) and, on Valkey 9, an empty mode. `services.internalCache` and `services.memoryStorage` get a new `server` field, `redis` or `valkey`; `type` stays `redis`. [`server:capabilities`](/core/2/api/controllers/server/capabilities) gives the real version too.

**Action:** if a monitoring tool or a plugin compares the cache version with Redis versions, check it on Valkey: it now reads Valkey's version (e.g. `9.0.0`).

## 2.61.2

Two fixes and one opt-in setting. Nothing to change in your configuration.

### Redis `commandTimeout`

With 2.61.1, a node whose Redis stops answering leaves the cluster within seconds. But the requests already waiting on Redis keep the node up until the 30-second limit of a failure shutdown. The ioredis `commandTimeout` option, which Kuzzle already passed to its Redis client, ends that wait. Set it in milliseconds on both `services.internalCache.options` and `services.memoryStorage.options`. A command Redis has not answered within that delay then fails, and so does the request that sent it, with a [`services.cache.timeout`](/core/2/api/errors/error-codes/services) error (503). Before 2.61.2, the error was `core.fatal.unexpected_error` (500). The failure shutdown then runs to its end instead of waiting for the 30-second limit.

**Action:** none, it is not set by default. Before you set it, read [When Redis stops answering](/core/2/guides/advanced/configuration#when-redis-stops-answering). It applies to every Redis command, so pick a value well above your slowest legitimate one and above `cluster.heartbeat`. A write that timed out may still have been applied by Redis.

### Failed Redis key scans

Kuzzle scans Redis keys to list or expire authentication tokens and for statistics. If such a scan failed midway (a `commandTimeout`, a lost connection), the error was not handled. The process crashed, or the operation never finished. The scan now fails with an error, which the caller handles like any other Redis error.
