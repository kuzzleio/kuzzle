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

This page covers Kuzzle **2.61**, starting with its first beta, 2.61.0-beta.1 (2.61.0-beta.2 adds the built-in drivers as packages, 2.61.0-beta.3 pins them to `1.0.0`, 2.61.0-beta.4 fixes the index and collection checks in a cluster, 2.61.0-beta.5 documents the OpenSearch 2 and 3 drivers). If you upgrade from an older version, read the [previous upgrade notes](/core/2/guides/upgrade-notes/from-2-59) too.

The API, the configuration and the TypeScript declarations stay compatible with v2.60.1. An Elasticsearch 7 or 8 setup needs no change. Items that may need an action on your side are marked **Action**.

The changelog is generated from the commits and says what was done. This page says what you may have to check.

## Operators

### Elasticsearch 7 and 8 run as built-in storage drivers

Kuzzle now talks to its database through a [storage driver](/core/2/guides/main-concepts/data-storage#storage-drivers). Elasticsearch 7 and 8 are its built-in drivers, still selected by `services.storageEngine.majorVersion`: their behavior and their configuration do not change.

Since 2.61.0-beta.2, their code lives in two packages, [`kuzzle-storage-es-7`](/drivers/storage-es-7/1/) and [`kuzzle-storage-es-8`](/drivers/storage-es-8/1/), which `kuzzle` depends on at pinned versions. `npm install` brings them with Kuzzle: there is nothing to add to your `package.json`. `npm ls kuzzle-storage-es-8` shows the version your Kuzzle uses.

Since 2.61.0-beta.3, both are pinned to their stable `1.0.0`. If the package of the configured `majorVersion` is missing (a partial install, a pruned `node_modules`), Kuzzle does not start and reports [`services.storage_driver.not_found`](/core/2/api/errors/error-codes/services). **Action**, only if you see it: run `npm install` again.

A rolling upgrade from v2.60 works as before: nodes running the built-in drivers are not compared when they join the cluster.

### Running another storage engine

Setting `services.storageEngine.driver` to the name of a driver package, installed next to `kuzzle`, runs Kuzzle on that driver's engine. In that case:

- `services.storageEngine.majorVersion` is ignored, and the rest of `services.storageEngine` is handed to the driver. If your configuration sets `majorVersion` too, Kuzzle logs a warning at startup: remove it;
- Kuzzle logs `[ℹ] Storage driver: <name>@<version>` at startup, instead of the Elasticsearch major version;
- Kuzzle does not start when the driver is missing, when its `manifest.json` is invalid, when its `kuzzleVersion` range excludes this Kuzzle version, or when it lacks a method of the storage contract or of a capability it declares (the [`services.storage_driver.*`](/core/2/api/errors/error-codes/services) errors). These messages say what to do: install the package, or, for `majorVersion: "9"` without a driver, set `driver` ([#3134](https://github.com/kuzzleio/kuzzle/issues/3134), [#3137](https://github.com/kuzzleio/kuzzle/issues/3137));
- the driver always uses the running Kuzzle, even when another copy of `kuzzle` sits in `node_modules`, as in the official Docker image ([#3132](https://github.com/kuzzleio/kuzzle/issues/3132)). Before, such a driver could answer some documented `404` or `400` errors as `500` `unexpected_error`;
- a request needing a capability the driver does not declare is rejected with [`services.storage_driver.unsupported_capability`](/core/2/api/errors/error-codes/services) (400).

**Action**, only if you use an external driver in a cluster: every node must run the same driver in the same version. A node running another one fails its startup with [`cluster.join.storage_driver_mismatch`](/core/2/api/errors/error-codes/cluster). Upgrading a driver therefore means restarting every node on the new version, not a rolling restart.

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
4. stop every Kuzzle node, then start them all on the new configuration. A rolling restart does not work: a node running `kuzzle-storage-es-9` is refused by nodes still running the built-in driver ([`cluster.join.storage_driver_mismatch`](/core/2/api/errors/error-codes/cluster)). Only nodes running the built-in Elasticsearch 7 and 8 drivers are not compared when they join.

The OpenSearch drivers do not move your data: copy it from Elasticsearch with a snapshot or a remote reindex.

### `majorVersion` is deprecated

`services.storageEngine.majorVersion` is deprecated in the documentation: Kuzzle 3 will select the storage engine with `driver` alone. It keeps working unchanged in Kuzzle 2, where it still chooses between the built-in Elasticsearch 7 and 8 drivers, and Kuzzle logs no deprecation warning for it.

### Index cache of a joining node

A node joining a cluster could keep, in its cache, an index or a collection that another node had deleted before it joined, and a collection write lock already released: the deletion was announced to the nodes already in the cluster only. When it loads its cache, a node now replaces it with what the storage holds.

### Index and collection checks in a cluster

Each node keeps the list of indexes and collections in memory, and learns about the ones another node creates or deletes through a cluster message that no request waits for. For a few milliseconds after a creation on one node, another node could answer that the index or the collection does not exist (`services.storage.unknown_index`, `unknown_collection`), leave it out of `index:list` or `collection:list`, or refuse to create an index another node had just deleted (`index_already_exists`).

A node now checks the storage before giving such an answer, and updates its list. As a result, `index:list`, `collection:list` and `index:stats` read the storage on every call, and a request on an index or a collection that does not exist costs one storage read before it fails. Requests on existing indexes and collections are unchanged.

## Plugin and application developers

### Raw storage clients

`app.storage.storageClient`, `app.storage.StorageClient` and `context.constructors.ESClient` are now built by the storage driver. With the built-in drivers, they give the same Elasticsearch client as before, in the same version and with the same API. With an external driver, they give that driver's engine client.

::: warning
With `services.storageEngine.driver` set, `services.storageEngine.majorVersion` is ignored, yet still holds a value: `"7"` by default. Code choosing the client's API from it (`majorVersion === "8" ? … : …`) picks the Elasticsearch 7 API, wrong for `kuzzle-storage-es-9`. The client's API follows the driver:

| Driver                                                                                 | Client API                                                                 |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| built-in Elasticsearch 7, `kuzzle-storage-opensearch-2`, `kuzzle-storage-opensearch-3` | Elasticsearch 7 shape: `body` in requests, responses wrapped in `{ body }` |
| built-in Elasticsearch 8, `kuzzle-storage-es-9`                                        | Elasticsearch 8 shape: `document` in requests, flat responses              |

**Action**, for plugin and application authors, before running on an external driver: do not infer the client's API from `majorVersion`; check `services.storageEngine.driver` first.
:::

Since 2.61.0-beta.2, that client comes from the driver package's own copy of `@elastic/elasticsearch`. **Action**, only if your code checks it with `instanceof` against a `Client` class it imports itself: compare its behavior instead, or import the class from the driver's dependencies. To type it, see the drivers' [TypeScript](/drivers/storage-es-8/1/typescript/) page.

### New exports

`kuzzle` now exports the `StorageDriver` contract and its types, the conformance kit `describeStorageDriverConformance`, and `storageError`, which builds Kuzzle's `services.storage.*` errors. They are meant for driver authors: see the [Write storage drivers](/core/2/guides/write-storage-drivers/start-writing-storage-drivers) guide.
