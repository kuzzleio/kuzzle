---
code: false
type: page
order: 400
title: Kuzzle 2.60 | Changelog | Guide | Core
meta:
  - name: description
    content: What Kuzzle 2.60 changes, in plain words
  - name: keywords
    content: Kuzzle, Documentation, changelog, 2.60, Node.js, cluster, locks
---

# Kuzzle 2.60

**Status:** in beta since 2026-10-12 (`npm install kuzzle@beta`). Not released as stable yet.

The [GitHub release notes](https://github.com/kuzzleio/kuzzle/releases) list every commit. This page tells you what changes for you. For what to check before you upgrade, read [Upgrading from 2.59](/core/2/guides/upgrade-notes/from-2-59).

## In short

2.60 makes a cluster start and stop reliably. Most fixes target what happens when several nodes start at the same time, or when a node stops or crashes while the cluster starts. It also moves Kuzzle to Node.js 22.12 or later.

## What you need to do

- **Use Node.js 22.12 or later.** Node.js 20 is no longer supported. Check the base image of your `Dockerfile`.
- **Check your log pipeline if it reads error fields.** Errors are now logged under an `err` field.
- **Check your token settings if you still use `security.jwt`.** Its `algorithm`, `expiresIn` and `maxTTL` were silently ignored since 2.16.8; they now apply. Move them to `security.authToken`.

Nothing else changes in the API or the TypeScript types.

## What's new

- **`withLock` everywhere.** Every cluster-wide lock Kuzzle takes now lasts as long as the work it protects. Some used to expire after 5 seconds, which let another node start the same work in parallel.
- **`MutexAcquireError`.** [`withLock`](/core/2/framework/functions/with-lock) now rejects with [this error](/core/2/framework/error-classes/mutex-acquire-error) when it cannot get the lock, so you can tell a busy lock apart.
- **Delete your own API key by key or fingerprint over HTTP**, with the new `DELETE /api-keys` route.
- **New type exports.** `StartOptions`, `InstallationConfig`, `ImportConfig` and `SupportConfig` name the options of the startup and of the plugin imports.

## What's fixed

### Starting a cluster

- Nodes wait for each other's startup imports (mappings, fixtures, permissions) instead of going on while they still run. A changed import is imported once, not at every start.
- A node that cannot join the cluster (another node has its IP address, the cluster cannot be reached, the join takes too long) now fails its startup with a clear `cluster.join.*` error. It used to keep starting in the background.
- A node restarted at once on the same IP address no longer mistakes its own previous registration for another node, and no longer loops on restarts.
- A node that joins late now sees the indexes and collections that the other nodes created before it joined, including during its plugins' `init()`.
- When two nodes create the same collection at the same time, both sets of mappings are applied. One of them used to be dropped, which could make a plugin fail its startup on a strict collection.
- A node stopped while it starts stops starting: it no longer takes the installations lock and makes the other nodes wait 30 seconds.
- Several cases where a cluster could stay stuck in a restart loop after a node stopped mid-startup are fixed: an internal setup left half done, a collection whose shards were not ready yet, cluster messages received too early.

### Stopping a node

- A failed startup now always stops the node and exits with code `1`, so a restart policy restarts it. In production, the node used to stay alive, half started.
- A shutdown caused by a failure is bounded to 30 seconds. A requested stop (`SIGTERM`, `admin:shutdown`) still waits for the requests in progress, and exits with code `0`.
- A node deletes its cluster registration and releases its locks when it stops, so the other nodes no longer wait for them to expire.
- A stop logs `Initiating shutdown...` once, not twice.

### Other fixes

- An empty Kuzzle index no longer keeps a useless extra Elasticsearch index once it has a real collection.
- A collection configured with `number_of_replicas` but no `number_of_shards` no longer fails the startup in development mode.
- An HTTP request with an empty body and large headers is now answered, instead of hanging until a proxy returns a `502`.
- An Elasticsearch error without a body now has a useful message, such as `Elasticsearch responded 503 (no body)`.
- `security.authToken.gracePeriod` is no longer ignored, and Kuzzle warns at startup when the deprecated `security.jwt` section is used.
- Installed with npm, Kuzzle finds your project's secrets file again (`config/secrets.enc.json`).
- `admin:loadFixtures` answers `{ acknowledge: true }` again, and a second `admin:shutdown` is refused while the node already shuts down.
- Four HTTP routes that pointed to long-removed actions are gone.

### For plugin and application developers

- A plugin request with `triggerEvents` that failed was run a second time, without events. It now fails once.
- `http:<verb>` events always use the lowercase verb (`http:get`), even for a route declared as `GET`.
- `request.getDate()` with a custom format and `request.getTimestamp()` with an integer string now work. A date string given to `getTimestamp()` is now rejected, instead of being cut to its first number.
- `Mutex.wait()` works without argument, `Logger.child()` returns a full `Logger`, and `Location` / `Last-Modified` response headers are replaced instead of concatenated.
- `InternalLogger` and the `Koncorde` class exported by Kuzzle are deprecated (see [Towards Kuzzle 3](/core/2/guides/kuzzle-3)).

## Under the hood

Several dependencies moved to a new major version (ioredis 6, aedes 1, protobufjs 8, cookie 2). Each one is configured to behave exactly as before. Production installs carry 23 fewer packages.
