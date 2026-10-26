---
code: false
type: page
order: 100
title: Upgrading from 2.59 | Upgrade notes | Guide | Core
meta:
  - name: description
    content: What you can observe when you upgrade Kuzzle from v2.59.0 to v2.60.0, and what to check
  - name: keywords
    content: Kuzzle, Documentation, upgrade, 2.60, Node.js, locks, release notes
---

# Upgrading from 2.59

This page covers Kuzzle **2.60.0**, including what its first beta, 2.60.0-beta.1, already shipped. If you upgrade from an older version, read the [previous upgrade notes](/core/2/guides/upgrade-notes/from-2-56) too.

The API, the configuration and the TypeScript declarations stay compatible with v2.59.0. The one requirement that changes is the Node.js version. Items that may need an action on your side are marked **Action**.

The changelog is generated from the commits and says what was done. This page says what you may have to check.

## Operators

### Node.js 22.12 or later is required

`engines.node` is now `>=22.12.0 <25.0.0`: **Node.js 20 is no longer supported**, and Node.js 22 and 24 are the tested versions. Several dependencies are now ESM-only packages that Kuzzle loads with `require()`, which Node.js only supports from 22.12 on.

As with the drop of Node.js 18 in 2.50.0, this ships in a minor version: nothing else in the API, the configuration or the typings changes with it.

**Action:** check the Node.js version of your Docker images (the base image of your `Dockerfile`) and of your other runtimes, and move them to Node.js 22.12 or later before you upgrade.

### Startup in a cluster

Every cluster-wide lock Kuzzle takes internally now uses [withLock](/core/2/framework/functions/with-lock), whose locks are extended for as long as the work they protect runs. Some of them used to expire after 5 seconds even when that work was still running, letting another node in: the locks of the installations (`app.install`), of the cluster handshake, of the hidden collections, and of `admin:resetSecurity` / `admin:resetDatabase`.

This changes what you can see while several nodes start together:

- **Nodes wait for each other's startup imports.** The mappings, fixtures and permissions imported at startup (`app.import`, plugin imports, `start-kuzzle-server` options) are run by one node, and the other nodes now wait for it to finish all of them before they go on. Before, they could go on while the import was still running. Once a waiting node gets its turn, it finds the import done and only loads it into its own cache; if the node ahead of it died mid-import, it runs the import itself.
- **A changed import payload is imported once.** When the payload of a startup import changed, its recorded fingerprint was not updated, so every later start imported it again. It is now replaced by the new one.
- **Plugin storage bootstrap.** [`context.accessors.storage.bootstrap`](/core/2/framework/classes/plugin-storage/bootstrap) used to create the collections on one node while the others waited and then only loaded them into their cache. Every node now creates them in turn, under the same lock, and waits for it with no limit.
- **Cluster handshake.** A joining node waits for the handshake lock with no retry limit: `cluster.joinTimeout` (60 seconds by default) is what still bounds the wait: it shuts the node down if it has not joined in time.
- **A lost lock fails the startup.** If one of these locks is lost while its work is running (for instance, Redis could not extend it), the startup fails with [`MutexLockLostError`](/core/2/framework/error-classes/mutex-lock-lost-error). A node that loses the handshake lock logs `[CLUSTER] Lost the handshake lock while joining the cluster. Shutting down.` and shuts down rather than stay half-joined.

A rolling upgrade from v2.59.0 keeps the nodes mutually excluded: a v2.59.0 node takes the same locks, on the same Redis keys, with the deprecated `Mutex`, and a `Mutex` and a `withLock` call exclude each other.

### A failed startup stops the node

When the startup fails (an `app.install` handler that throws, an import that cannot be applied, a lost startup lock…), the node now shuts down gracefully and exits with code `1`, whatever `NODE_ENV` is. It used to depend on `NODE_ENV`:

- in production, the error was only logged and the process stayed alive, half started: nothing listened for requests, but its ID card kept it registered in the cluster, and a restart policy never fired;
- in development, it shut down but exited with code `0`, so an `on-failure` restart policy did not restart it.

An uncaught exception, `SIGQUIT` and `SIGABRT`, which shut Kuzzle down after an optional dump, now exit with code `1` too, instead of `0`. So does a node that leaves the cluster because of a failure: it did not join within `cluster.joinTimeout`, another node has its IP address, it cannot reach the nodes it discovered (network split), it finds itself outside the cluster, or its cluster consistency check fails. A cluster-wide shutdown requested through the API still exits with code `0`.

A node restarted at once on the same IP address (a container restarted by its restart policy, a process killed) used to find the ID card of its previous run, still in Redis for a few seconds, take it for another node with its IP, and stop again, leaving its own card behind: it could loop like this. Now a node deletes its ID card when it shuts down instead of leaving it to expire, and a joining node that finds a card with its IP waits for that card to expire (`cluster.heartbeat` × 3, 6 seconds by default) before it concludes that another node really has its IP.

A node that cannot join the cluster now fails its startup: `app.start()` rejects with [`cluster.join.duplicate_ip`, `cluster.join.full_state_unavailable` or `cluster.join.timeout`](/core/2/api/errors/error-codes/cluster). It used to begin shutting down while it went on starting in the background: running its imports and installations, opening its ports and logging that it was ready, until the shutdown ended the process.

The entrypoint of the official `kuzzleio/kuzzle` image used to exit at once, before that shutdown could release the node's locks and remove it from the cluster. It now lets the shutdown finish, after a failed startup and when its `--fixtures` cannot be loaded.

A shutdown caused by a failure is bounded: if it has not finished after 30 seconds (for instance, a `kuzzle:shutdown` pipe that never returns), Kuzzle logs `[shutdown] Not finished after 30000ms: exiting now` and exits with code `1` anyway. A requested shutdown (`SIGTERM`, `SIGINT`, `admin:shutdown`) still waits for the requests in progress, however long they take.

A requested shutdown exits with code `0`. During the betas of 2.60, it could exit with code `1` when a plugin unlocked a [`Mutex`](/core/2/framework/classes/mutex) that the shutdown had already released; unlocking it there now does nothing.

**Action:** none. A failed start could not be retried anyway: a second `app.start()` fails on "another one already exists". The error is still returned by `app.start()` before the process exits, so a `catch` that logs it keeps working.

### A node that stops during a cluster startup

These cases appear when a node stops (`SIGTERM`, `SIGKILL`, a crash) while the cluster starts, and another node takes over its work:

- **The internal index bootstrap can be resumed.** If a node stopped after it recorded the data model version of the internal index but before it marked the bootstrap as done, every later start failed with "Document already exists": if that node never came back, the whole cluster could stay in a restart loop. The next node now finishes that bootstrap. It keeps the secret seed the first node already stored, since other nodes may sign tokens with it.
- **Nodes wait for the shards of an existing collection.** A node that finds a collection already created by another node now waits for its primary shards to be active (Elasticsearch `yellow` status) before it uses it. Right after the creating node stopped, a node could reach a shard that was still initializing and fail its startup with a `503`. The same wait applies to `collection:create` on a collection that already exists. The wait lasts up to 30 seconds, a fixed value: a collection whose primary shards are still not active after that (a `red` index) fails the startup or the request with `services.storage.unexpected_error`, as it would have failed on its first request before. A collection whose shards are active is not delayed.
- **Indexes created by another node are known.** A node now reloads the list of indexes and collections from Elasticsearch when it has joined the cluster. An index created by a node that stopped before this node joined used to stay unknown to it: requests to it failed with `services.storage.unknown_index`, and an `index:create` on it failed with `index_already_exists` without fixing that.
- **Cluster messages received before the handshake.** A node restarted on the IP address of a node that just stopped can get messages meant for that previous node before it has joined. It used to throw `[CLUSTER] No node id yet` and, for an eviction message, restart again. It now refuses those requests, and the node that sent them asks another node.

A rolling upgrade from v2.59.0 is not affected: a v2.59.0 node that gets one of these refusals handles it as before.

### Collections with `number_of_replicas` only

When a collection already exists, Kuzzle compares its `number_of_shards` with the configured one, as the shard count of an existing collection cannot change. A collection configured with `number_of_replicas` but no `number_of_shards` failed that check on every start: a warning in production and, in development mode (`NODE_ENV=development`), a startup failure with `core.fatal.unexpected_error`. The check is now skipped when `number_of_shards` is not configured.

A real mismatch in development mode now fails with its documented error, [`services.storage.wrong_es_static_settings_for_collection_recreation`](/core/2/api/errors/error-codes/services), instead of `core.fatal.unexpected_error`. In production, it is still only logged as a warning.

### Placeholder index of an empty Kuzzle index

An index created with `index:create` holds a hidden `_kuzzle_keep` collection, backed by its own Elasticsearch index, so that the empty index exists in Elasticsearch. Creating the first real collection was meant to drop it, but it was recreated straight away: every Kuzzle index kept that extra Elasticsearch index. It is now dropped, once the real collection has been created.

Indexes that already hold it keep it until a new collection is created in them; nothing removes it on upgrade. Deleting a collection still recreates it, as before.

### Logs

- **Errors are logged under `err`.** Kuzzle uses kuzzle-logger 1.5 or later: an error is logged under an `err` field, with its `name`, `message`, `stack`, `cause` and custom properties (such as a `KuzzleError`'s `id` and `status`), instead of having only its enumerable properties spread at the top level of the log entry. The `namespace`, `nodeId` and `requestId` fields are applied to error entries too.
  **Action:** if a log pipeline, dashboard or alert reads error fields at the top level of Kuzzle's logs, point it to `err`.
- **Elasticsearch errors without a body.** When Elasticsearch answers an error with no body (a `503` while shards initialize, for instance), the `services.storage.unexpected_error` error used to have an empty message (ES 8) or `Response Error` (ES 7). Its message now gives the HTTP status, for instance `ResponseError: Elasticsearch responded 503 (no body)`.
- **One shutdown per node.** A stop no longer logs `Initiating shutdown...` twice, and a node that lost Redis for a while logs `[CLUSTER] Node too slow: ID card expired` and shuts down once, instead of once per missed ID card renewal. A failure reported while the node is already shutting down, such as a cluster eviction during a `SIGTERM` stop, still makes it exit with a non-zero code.
- The Loki preset now runs on pino-loki 3 (through kuzzle-logger 1.7). The preset keeps the behaviour it had with pino-loki 2: logs are still batched every second by default, and `meta` is not sent as structured metadata unless asked for.

### HTTP

- A request with an empty body (`Content-Length: 0`) whose headers span several TCP packets is now answered. It used to hang until the idle timeout, which a reverse proxy forwarding large headers turned into a `502`.

### Dependencies

These dependencies changed major version. Each was pinned to its previous behaviour, and nothing changes in what you configure:

- **ioredis 6.** ioredis 6 speaks RESP3 by default, enables TCP keep-alive after 30 seconds and retries a lost connection with an exponential backoff. Kuzzle keeps ioredis 5's values for `protocol` (RESP2), `keepAlive` and `retryStrategy`, so nothing changes on the wire nor in how a lost connection is retried. A value set in the `services.internalCache` or `services.memoryStorage` options still wins over these.
- **aedes 1** (MQTT). aedes 1 disconnects a client whose socket stays undrained for 60 seconds; Kuzzle 2 turns that timeout off, as aedes 0.x had none.
- **protobufjs 8** (cluster messages). Kuzzle keeps the wire format of protobufjs 7, so nodes of v2.59.0 and v2.60.0 understand each other during a rolling upgrade.
- **cookie 2.** The `Set-Cookie` headers sent by `auth:login` / `auth:logout`, and the cookies parsed from requests, are the same as before.
- **redis-semaphore 6** (the lock library behind `withLock`) only changes its packaging.
- The unused `inquirer` dependency is removed: production installs carry 23 fewer packages.

## Application and plugin developers

- **New export: [`MutexAcquireError`](/core/2/framework/error-classes/mutex-acquire-error).** [`withLock`](/core/2/framework/functions/with-lock) now rejects with it when it cannot acquire the lock within its attempts, instead of a plain `Error` with the same message. It extends `Error`, so a `catch` that handled the plain `Error` still works; you can now tell a busy lock apart with `instanceof MutexAcquireError`.
- **New type exports:** `StartOptions`, `InstallationConfig`, `ImportConfig` and `SupportConfig` can be imported from `kuzzle`. They name the options of the server's start and the shapes of `Plugin.imports`.
- **`withLock` and `Mutex` on the same key.** The previous upgrade notes said not to use both on the same key. They can be: both take the same Redis key with `SET NX`, so they exclude each other, and you can migrate your `Mutex` call sites one at a time. See [Migrating to withLock](/core/2/framework/classes/mutex/constructor#migrating-to-withlock).
- **A failed `app.start()` ends the process.** An application test that expects `app.start()` to reject now sees the process exit with code `1` right after (see [A failed startup stops the node](#a-failed-startup-stops-the-node)); mock `process.exit` in such a test.
- **Locks released at shutdown.** A node that stops now releases the locks it took with `withLock` before it exits, as it already did for `Mutex`, so the other nodes no longer wait for them to expire.
