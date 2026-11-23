---
code: false
type: page
order: 25
title: Upgrading from 2.61 | Upgrade notes | Guide | Core
meta:
  - name: description
    content: What you can observe when you upgrade Kuzzle from v2.61 to v2.62, and what to check
  - name: keywords
    content: Kuzzle, Documentation, upgrade, 2.62, signals, tini, locks, reindex, release notes
---

# Upgrading from 2.61

This page covers Kuzzle **2.62**, starting with its first beta, 2.62.0-beta.1. It includes the changes of 2.61.4-beta.1 and 2.61.4-beta.2, which were not released as a stable 2.61.4. If you upgrade from an older version, read the [previous upgrade notes](/core/2/guides/upgrade-notes/from-2-60) too.

The API, the configuration and the TypeScript declarations stay compatible with v2.61.3. Items that may need an action on your side are marked **Action**.

The changelog is generated from the commits and says what was done. This page says what you may have to check.

### Signals received while Kuzzle loads

When `node` ran as a container's main process without an init, a `SIGTERM` or `SIGINT` received while the application loaded its modules was ignored, and the orchestrator killed the node after its grace period. Kuzzle now handles such a signal from the moment the application imports `kuzzle`:

- if the event loop turns before `app.start()` is called, Kuzzle exits at once, with code `143` (`SIGTERM`) or `130` (`SIGINT`), after writing `Caught signal SIGTERM before Kuzzle started: exiting now` to the standard error;
- if the application loads its modules synchronously and calls `app.start()` right after, as the project templates do, the signal waits for `app.start()`, which then stops Kuzzle gracefully, as a signal received during the startup always did.

A signal received before `kuzzle` is imported is still ignored without an init. From `app.start()` on, a signal stops Kuzzle gracefully, as before.

**Action:** none. To forward signals and reap child processes, run your application under an init process: `init: true` with Docker Compose, `docker run --init`, or tini as your image's `ENTRYPOINT` (see [Run Kuzzle under an init process](/core/2/guides/advanced/cluster-scalability#run-kuzzle-under-an-init-process)).

### tini in the official image

The official `kuzzleio/kuzzle` image now has `ENTRYPOINT ["/usr/bin/tini", "--"]`: tini runs as PID 1 and starts Kuzzle. The `CMD` does not change, so a container that overrides it keeps working, under tini.

**Action:** if an image built from `kuzzleio/kuzzle` sets its own `ENTRYPOINT`, it replaces tini: keep `/usr/bin/tini --` in front of it.

### Lost cluster-wide locks are logged

A node holding a cluster-wide lock ([withLock](/core/2/framework/functions/with-lock), and the locks Kuzzle takes itself) renews it while its code runs. If the node stalls for longer than the lock's TTL, the lock expires and another node may take it. Kuzzle now logs it as a warning, once per lock, for instance `Lock "backend:import:mappings" lost: it expired, or another node holds it. This node last extended it 12043 ms ago (TTL: 10000 ms): …`. This includes a loss found only when the lock is released, after its code has ended.

**Action:** none. Such a warning means that two nodes may have run the same code at the same time: you may want to alert on `lost:` warnings, and look for what stalled the node at that time.

### Roles read again after a failed read

When a node failed to read a role from the storage, it kept that failure in its cache: every later lookup of the role failed without reading it again, until the role was changed or the node restarted. Rights checks of the users whose profile uses the role, and profile searches returning such a profile, failed meanwhile. The failure is now dropped and the next lookup reads the role again.

**Action:** none.

### Background reindex event

A [collection:update](/core/2/api/controllers/collection/update) that makes the storage engine reindex a collection in the background now emits [core:storage:collection:reindex:start](/core/2/framework/events/core#core-storage-collection-reindex-start) with the engine's task id, when the driver tells it: `kuzzle-storage-es-7`, `kuzzle-storage-es-8` and `kuzzle-storage-es-9` from 1.2.0. It is a hook event, emitted before the request is answered; the API response does not change.

**Action:** none. A storage driver may answer `{ reindexTaskId }` from `updateCollection` to trigger it (see the [driver contract](/core/2/guides/write-storage-drivers/contract)); a driver that keeps answering `null` still works.
