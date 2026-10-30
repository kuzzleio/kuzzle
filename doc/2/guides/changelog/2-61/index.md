---
code: false
type: page
order: 390
title: Kuzzle 2.61 | Changelog | Guide | Core
meta:
  - name: description
    content: What Kuzzle 2.61 changes, in plain words
  - name: keywords
    content: Kuzzle, Documentation, changelog, 2.61, storage, drivers, Elasticsearch
---

# Kuzzle 2.61

**Status:** in beta since 2026-10-30 (2.61.0-beta.1).

The [GitHub release notes](https://github.com/kuzzleio/kuzzle/releases) list every commit. This page tells you what changes for you. For what to check before you upgrade, read [Upgrading from 2.60](/core/2/guides/upgrade-notes/from-2-60).

## In short

2.61 opens Kuzzle to other storage engines. A storage engine can now come as a separate npm package, a _storage driver_, that you install next to Kuzzle and name in the configuration. Elasticsearch 7 and 8 keep working exactly as before: they are now Kuzzle's built-in drivers.

## What you need to do

Nothing. An Elasticsearch 7 or 8 setup needs no change, in its configuration or its dependencies.

## What's new

- **Storage drivers.** Set `services.storageEngine.driver` to the name of a driver package to run Kuzzle on another storage engine. Kuzzle checks the driver at startup and refuses to start if it is missing, invalid or not made for this Kuzzle version. The API does not change: queries and mappings are still written in the Elasticsearch format. Read [Storage Drivers](/core/2/guides/main-concepts/data-storage#storage-drivers).
- **Capabilities.** A driver may not support every feature (aggregations, mapping changes, statistics, update by query). A request needing one it does not support is rejected with a clear [`services.storage_driver.unsupported_capability`](/core/2/api/errors/error-codes/services) error. The built-in drivers support them all.
- **Same driver on every cluster node.** A node running another driver, or another version of it, than the rest of the cluster is refused when it joins, with a [`cluster.join.storage_driver_mismatch`](/core/2/api/errors/error-codes/cluster) error. Nodes running the built-in Elasticsearch drivers are not compared, so an Elasticsearch 7 or 8 cluster joins as before.
- **For driver authors.** `kuzzle` exports what a driver needs: the `StorageDriver` contract and its types, a conformance kit (`describeStorageDriverConformance`) that tests a driver against its real engine, and `storageError`, so that a driver returns the same errors as Kuzzle. Read [Writing a driver](/core/2/guides/main-concepts/data-storage#writing-a-driver).

## What's fixed

- A node joining a cluster could still list an index or a collection that another node had deleted before it joined, and keep a collection lock that was already released. It now replaces its cache with what the storage holds when it loads it.
