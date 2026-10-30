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

This page covers Kuzzle **2.61**, starting with its first beta, 2.61.0-beta.1. If you upgrade from an older version, read the [previous upgrade notes](/core/2/guides/upgrade-notes/from-2-59) too.

The API, the configuration and the TypeScript declarations stay compatible with v2.60.1. An Elasticsearch 7 or 8 setup needs no change. Items that may need an action on your side are marked **Action**.

The changelog is generated from the commits and says what was done. This page says what you may have to check.

## Operators

### Elasticsearch 7 and 8 run as built-in storage drivers

Kuzzle now talks to its database through a [storage driver](/core/2/guides/main-concepts/data-storage#storage-drivers). Elasticsearch 7 and 8 are its built-in drivers, still selected by `services.storageEngine.majorVersion`: their behavior, their configuration and their dependencies do not change.

A rolling upgrade from v2.60 works as before: nodes running the built-in drivers are not compared when they join the cluster.

### Running another storage engine

Setting `services.storageEngine.driver` to the name of a driver package, installed next to `kuzzle`, runs Kuzzle on that driver's engine. In that case:

- `services.storageEngine.majorVersion` is ignored, and the rest of `services.storageEngine` is handed to the driver. If your configuration sets `majorVersion` too, Kuzzle logs a warning at startup: remove it;
- Kuzzle logs `[ℹ] Storage driver: <name>@<version>` at startup, instead of the Elasticsearch major version;
- Kuzzle does not start when the driver is missing, when its `manifest.json` is invalid, when its `kuzzleVersion` range excludes this Kuzzle version, or when it lacks a method of a capability it declares (the [`services.storage_driver.*`](/core/2/api/errors/error-codes/services) errors);
- a request needing a capability the driver does not declare is rejected with [`services.storage_driver.unsupported_capability`](/core/2/api/errors/error-codes/services) (400).

**Action**, only if you use an external driver in a cluster: every node must run the same driver in the same version. A node running another one fails its startup with [`cluster.join.storage_driver_mismatch`](/core/2/api/errors/error-codes/cluster). Upgrading a driver therefore means restarting every node on the new version, not a rolling restart.

### `majorVersion` is deprecated

`services.storageEngine.majorVersion` is deprecated in the documentation: Kuzzle 3 will select the storage engine with `driver` alone. It keeps working unchanged in Kuzzle 2, where it still chooses between the built-in Elasticsearch 7 and 8 drivers, and Kuzzle logs no deprecation warning for it.

To run Elasticsearch 9, install [`kuzzle-storage-es-9`](https://www.npmjs.com/package/kuzzle-storage-es-9) next to `kuzzle` and set `services.storageEngine.driver` to `"kuzzle-storage-es-9"`.

### Index cache of a joining node

A node joining a cluster could keep, in its cache, an index or a collection that another node had deleted before it joined, and a collection write lock already released: the deletion was announced to the nodes already in the cluster only. When it loads its cache, a node now replaces it with what the storage holds.

## Plugin and application developers

### Raw storage clients

`app.storage.storageClient`, `app.storage.StorageClient` and `context.constructors.ESClient` are now built by the storage driver. With the built-in drivers, they give the same Elasticsearch client as before. With an external driver, they give that driver's engine client.

### New exports

`kuzzle` now exports the `StorageDriver` contract and its types, the conformance kit `describeStorageDriverConformance`, and `storageError`, which builds Kuzzle's `services.storage.*` errors. They are meant for driver authors: see [Writing a driver](/core/2/guides/main-concepts/data-storage#writing-a-driver).
