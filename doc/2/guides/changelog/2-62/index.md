---
code: false
type: page
order: 380
title: Kuzzle 2.62 | Changelog | Guide | Core
meta:
  - name: description
    content: What Kuzzle 2.62 changes, in plain words
  - name: keywords
    content: Kuzzle, Documentation, changelog, 2.62, storage, reindex, signals, tini, locks
---

# Kuzzle 2.62

**Status:** in beta since 2026-11-23 (2.62.0-beta.1).

The [GitHub release notes](https://github.com/kuzzleio/kuzzle/releases) list every commit. This page tells you what changes for you. For what to check before you upgrade, read [Upgrading from 2.61](/core/2/guides/upgrade-notes/from-2-61).

## 2.62.0

### In short

Plugins can now follow the background reindex a mapping update starts. A node stopped while it loads no longer waits for its grace period, the official image runs Kuzzle under an init process, and a lost cluster-wide lock is logged. A failed read of a role no longer breaks rights checks until the node restarts.

2.62.0 also carries the changes of 2.61.4-beta.1 and 2.61.4-beta.2, which were not released as a stable 2.61.4.

### What you need to do

Nothing. If you run your application in a container yourself, run it under an init process, for instance `init: true` with Docker Compose (see [Stopping a node](/core/2/guides/advanced/cluster-scalability#stopping-a-node)).

### What's new

- **Follow a background reindex.** When a mapping update makes the storage engine reindex a collection's documents in the background ([collection:update](/core/2/api/controllers/collection/update) with `reindexCollection`, or a change of `dynamic`), Kuzzle now emits the hook event [core:storage:collection:reindex:start](/core/2/framework/events/core#core-storage-collection-reindex-start), with the engine's id of that task, so that a plugin can follow it. The Elasticsearch 7, 8 and 9 drivers tell that id since their 1.2.0; with a driver that does not, the event is not emitted. The API response does not change.
- **For driver authors:** `updateCollection` may answer `{ reindexTaskId }` (type `StorageCollectionUpdateResult`) when it started a background reindex. It is optional: any other answer stays valid. The conformance kit checks that a task id a driver tells is a non-empty string (see the [driver contract](/core/2/guides/write-storage-drivers/contract)).
- **The official `kuzzleio/kuzzle` image runs Kuzzle under [tini](https://github.com/krallin/tini).** tini forwards signals to Kuzzle and reaps the child processes Kuzzle starts. The image's start command (`CMD`) does not change.
- **A lost cluster-wide lock is logged.** A node that stalls for longer than a lock's TTL (a frozen process, an unreachable Redis) loses that lock, and another node may then run the same code at the same time. Kuzzle now logs a warning naming the lock whenever a node finds out it lost one, even after the code that held it has ended ([#3212](https://github.com/kuzzleio/kuzzle/issues/3212)).
- **New in the docs:** [Stopping a node](/core/2/guides/advanced/cluster-scalability#stopping-a-node): what a graceful stop does, how long the rest of the cluster takes to notice a node killed without one, measured on 3-node clusters, and how to run Kuzzle under an init process.

### What's fixed

- **A node stopped while it loads no longer waits for its grace period.** When `node` is the container's main process, a `SIGTERM` received while a large application was still loading its modules was ignored, and the orchestrator killed the node only at the end of its grace period. Kuzzle now handles a `SIGTERM` or `SIGINT` received once the application has imported `kuzzle`: it exits at once, or stops gracefully as soon as `app.start()` is called ([#3087](https://github.com/kuzzleio/kuzzle/issues/3087), [#3223](https://github.com/kuzzleio/kuzzle/issues/3223)).
- **A failed read of a role is no longer kept.** When reading a role from the storage failed (a timeout, for instance), the failure stayed in the node's cache: every rights check of a user whose profile uses that role, and every profile search returning such a profile, failed on that node until the role was changed or the node restarted. The next lookup now reads the role again ([#3203](https://github.com/kuzzleio/kuzzle/pull/3203)).

### Under the hood

- `kuzzle-storage-es-7` and `kuzzle-storage-es-8` 1.2.0-beta.1: they tell the id of the background reindex task.
