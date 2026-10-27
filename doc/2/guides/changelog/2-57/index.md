---
code: false
type: page
order: 430
title: Kuzzle 2.57 | Changelog | Guide | Core
meta:
  - name: description
    content: What Kuzzle 2.57 changes, in plain words
  - name: keywords
    content: Kuzzle, Documentation, changelog, 2.57, TypeScript, withLock, cluster
---

# Kuzzle 2.57

**Released:** 2026-09-30. [GitHub release](https://github.com/kuzzleio/kuzzle/releases/tag/v2.57.0).

The GitHub release lists every commit. This page tells you what changes for you. For what to check before you upgrade, read [Upgrading from 2.56](/core/2/guides/upgrade-notes/from-2-56).

## In short

Kuzzle is now written entirely in TypeScript, in `strict` mode. The rewrite was held to a "no behaviour change" rule, and it brought to light a number of long-standing bugs, fixed in this release.

## What you need to do

- **Raise `limits.maxFormFileSize` if you accept large uploads.** This limit (1 MB by default) was never enforced; now it is.
- **Update the clients that switch on a few error ids.** Some situations used to answer a generic or wrong error id: a disconnected Redis, an overloaded Elasticsearch, a write without a body… See the table in [Upgrading from 2.56](/core/2/guides/upgrade-notes/from-2-56#api-clients).
- **Import `Kuzzle`, `WebSocket`, `Http` and `KuzzleAbstractProtocol` from `kuzzle-sdk`.** Kuzzle still re-exports them, but they are deprecated.

## What's new

- **[`withLock`](/core/2/framework/functions/with-lock)**: a distributed lock across the cluster, which lasts as long as the work it protects. It replaces `Mutex`, now deprecated.
- **Cluster messages are retransmitted.** A node that misses a message asks for it again instead of leaving the cluster (`cluster.retransmitBuffer`).
- **API keys can be deleted** by the key itself or by its fingerprint, not only by its id.
- **No compiler needed at install time** on Linux (x64 and arm64) and macOS: Kuzzle's native modules ship prebuilt.
- **Node names.** Each node has a name (`knode-…`), shown in API responses, notifications, the `X-Kuzzle-Node` header and Redis.
- **New type exports** `KuzzleUser` and `KuzzleToken`, for `request.context.user` and `request.context.token`.

## What's fixed

- `start-kuzzle-server` options (`--mappings`, `--fixtures`, `--securities`…) were all ignored. They work now.
- A node evicted from the cluster exits with code `1` instead of staying up, detached.
- Joining a cluster fails less often, and a stopping node releases its locks.
- HTTP connections carry their real headers in the `connection:*` events and the access logs.
- Realtime subscriptions with geospatial filters no longer fail after some unsubscriptions.
- `document:export` honours `sort`.
