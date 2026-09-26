---
code: false
type: page
order: 100
title: Upgrading from 2.56 | Upgrade notes | Guide | Core
meta:
  - name: description
    content: What you can observe when you upgrade Kuzzle from v2.56.0, and what to check
  - name: keywords
    content: Kuzzle, Documentation, upgrade, 2.56, TypeScript, release notes
---

# Upgrading from 2.56

This release is **not breaking**. It is the first Kuzzle built entirely from TypeScript in `strict` mode, and the migration was held to a _no behaviour change_ rule: the functional test suites of v2.56.0 pass unchanged against it.

This page lists what you **can** observe after the upgrade (fixes of long-standing defects, and a few additions), so that you can check it against your usage. Items that may need an action on your side are marked **Action**.

The changelog is generated from the commits and says what was done. This page says what you may have to check.

::: info
The version is first published as a **beta** (npm `beta` tag). Please report any difference with v2.56.0 that this page does not list.
:::

## Operators

### Configuration and HTTP

- **Multipart uploads are now size-limited.** `limits.maxFormFileSize` (default 1 MB) was never enforced; now it is. A multipart file above it gets `413 network.http.file_too_large`, even where `maxRequestSize` was raised.
  **Action:** if you accept larger uploads, raise `limits.maxFormFileSize` too.
- **HTTP connections carry their real headers.** They were always empty (`{}`). They now reach the `connection:new` / `connection:remove` hook payloads and the access logs, **including `authorization` and `cookie` in the `logstash` access-log format**.
  **Action:** if your access logs are shipped somewhere `Authorization` or cookie values must not go, filter them there. (The JWT was already logged through the request input.)
- **Node identity.** Each node now has a name (`knode-…` unless your `Backend` names it). It appears in the Redis client name (`CLIENT LIST`), the cluster ID card, the `node` field of realtime notifications **and of every API response**, and the `X-Kuzzle-Node` HTTP header (which read the literal string `"undefined"`).

### Cluster

- A node that misses a sync message now asks its sender to **retransmit** it instead of leaving the cluster. The new setting `cluster.retransmitBuffer` controls it (`{ messages: 1000, bytes: 16 MiB }` by default; `0` in either field disables it).
  A rolling upgrade from v2.56.0 is supported: an older node answers the new request with "unknown", and the newer one falls back to the old behaviour. Until every node runs this version, a lost message is therefore handled as on v2.56.0.
- An evicted node **exits with code 1**. It used to stay up, detached from the cluster, with state that had stopped advancing. With a restart policy, it comes back.
- Joining a cluster is more reliable. An existing node now answers a joiner's handshake within its timeout; about 1–3 % of joins failed at the default heartbeat, more with a longer one.
- A node that stops, including one evicted while it is still starting, frees the cluster-wide locks it holds before it exits. The other nodes no longer wait for those locks to expire.

### Command line and runtime

- **`start-kuzzle-server` options work.** They were all ignored (the argument parser was given an empty list). Now `--mappings`, `--fixtures` and `--securities` import at startup, `--vault-key` / `--secrets-file` override the environment variables, `--help` / `--version` print and exit, and an option given without a value stops the boot with a message. `--enable-plugins` names a plugin the published package does not ship: it logs a warning and the boot continues.
  **Action:** if your deployment passes options to this command (the Docker image's default command does not), check that they still do what you meant.
- **Dumps** (`dump.enabled`, off by default). A dump's suffix is validated: `admin:dump` answers `api.assert.invalid_argument` for anything outside `[A-Za-z0-9_-]{0,64}`. Automatic dumps after a handled error name themselves within that limit, and a dump failure is logged instead of raised.
- **Node.js** support is unchanged (`>=20 <25`). As for v2.56.0, the real minimum is **20.19**, which the `uuid` dependency requires.
- **Installing needs no compiler any more** on `linux-x64` and `linux-arm64` (glibc 2.31+, i.e. every Debian image from bullseye on) and on macOS. The native modules Kuzzle maintains (`dumpme`, and `boost-geospatial-index` and `kuzzle-espresso-logic-minimizer` through `koncorde`) now ship prebuilt binaries, so `npm install` no longer compiles them nor downloads Node headers. Nothing to change in a Dockerfile: a build stage that has a compiler keeps working, and a slim image without one now works too. On Alpine (musl) or another architecture, they are still compiled at install time as before.
  The geospatial index is also built with a fixed C++ standard. Before, the standard came from the Node version that compiled it, and on arm64 a Node 24 build could order or return geospatial results differently from a Node 20/22 one. All builds now behave like the Node 20/22 one.

## API clients

These error **ids** changed. Each one was a wrong or generic id for a known situation; a client that switches on the old id needs to be updated.

| Situation | v2.56.0 | Now |
| --- | --- | --- |
| A native controller crashes on an unexpected (non-Kuzzle) error | `plugin.runtime.unexpected_error` | `core.fatal.unexpected_error` (still 500) |
| Redis is disconnected | `core.fatal.unexpected_error` (500) | `services.cache.not_connected` (**503**) |
| Elasticsearch rejects for load (`es_rejected_execution_exception`) | `core.fatal.unexpected_error` | `services.storage.too_many_operations` |
| A document write action sent without a body | a 500 | `api.assert.body_required` (400) |
| An SDK call from a plugin without user or token; an unknown strategy or plugin; a malformed WebSocket frame | a crash-shaped 500 | the documented id |
| `document:search` with `targets[].collections: null` | `api.assert.missing_argument` | `api.assert.invalid_type` (still 400) |

See the [error codes](/core/2/api/errors/error-codes) reference for each id.

Other observable changes:

- [`document:export`](/core/2/api/controllers/document/export) honours `sort` (an array, an object or a field name).
- API keys can be deleted by `key` or by `fingerprint` ([`security:deleteApiKey`](/core/2/api/controllers/security/delete-api-key), and a new `DELETE /users/:userId/api-keys` route). Mind that the HTTP form puts the clear-text key in the URL. **Keys created before the upgrade can only be deleted by `_id`**: their `fingerprint` is not indexed.
- `auth:logout` clears the cookie as `authToken=` (it was `authToken=null`). The anonymous user's `auth:getCurrentUser` has `strategies: []` (it was `[[]]`).
- Two realtime subscriptions to the same collection, one with `users: "out"` and one with `users: "none"`, used to share a channel, and one of them got the other's notifications. Each now has its own channel.
- The two `plugin.*.invalid_openapi_schema` error codes are removed from the catalogue: nothing raised them.

## Application and plugin developers

### TypeScript

- The exported declarations now come from a `strict` build. A project that compiled against v2.56.0 compiles against this version, with `strict` on or off, and a CI gate keeps it that way.
  Where v2.56.0 declared a type that the runtime did not always honour, the v2.56.0 declaration is kept for compatibility, and the JSDoc says what the runtime does. For example, `getIndex({ required: false })` can return `null`, and `getHeader()` returns `undefined` for a missing header.
- **Kuzzle's own contract types.** `JSONObject` is now declared by Kuzzle. It is identical to the SDK's, and the two assign to each other both ways.
  The new type exports **`KuzzleUser`** and **`KuzzleToken`** name what `request.context.user` and `request.context.token` are. The exported `User` is the SDK's client-side user, as `app.sdk.security.*` returns it, and the exported `Token` interface is not the runtime token.
- The SDK is still re-exported under every name it was, but by an explicit list: what the SDK adds from now on is not part of Kuzzle's API. Four client-transport re-exports are **deprecated**: `Kuzzle`, `WebSocket`, `Http` and `KuzzleAbstractProtocol`.
  **Action:** import them from `kuzzle-sdk`. On the server, `app.sdk` is already a client.

### Runtime API

- New exports: `withLock`, a distributed and reentrant Redis lock, and `MutexLockLostError`. `withLock` replaces the deprecated `Mutex`; do not use both on the same key.
- `request.response.configure({ result })` sets a result without resetting the status; `request.setResult` stays, deprecated. `request.getArrayOrCsv()` names what `getArrayLegacy()` did; `getArrayLegacy()` is still available, deprecated.
- `Protocol.entryPoint` is read-only for custom protocol plugins.
- Deep imports from `kuzzle/dist/lib/…` are not a supported API. Four modules changed their CommonJS shape (the `admin`, `auth` and `security` controllers, and `cluster/state`), and two files are gone (`util/wildcard`, and the misspelt `adminControlller.type`).
- Error reporting: a thrown value's `message` is used as before, never its serialised contents. A thrown `null` gives "…: undefined" instead of crashing.
- Errors of the `PluginImplementationError` class (the `plugin.*` ids, and a few others) no longer end with "This is probably not a Kuzzle error, but a problem with a plugin implementation.". When your code throws something that is not a Kuzzle error, the `plugin.runtime.unexpected_error` wrapping it reads `Caught an unexpected plugin error: <your message>`, and its stack goes straight on to your own frames. Ids and codes are unchanged.
