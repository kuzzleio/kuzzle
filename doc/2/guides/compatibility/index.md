---
code: false
type: page
order: 640
title: Compatibility matrix | Guide | Core
meta:
  - name: description
    content: The Node.js versions, platforms, storage engines and cache servers Kuzzle 2 runs on
  - name: keywords
    content: Kuzzle, Documentation, compatibility, supported versions, Node.js, Elasticsearch, OpenSearch, Redis, Valkey
---

# Compatibility matrix

This page lists what Kuzzle 2 runs on: Node.js, operating systems, storage engines and cache servers. It describes the latest 2.x release, **2.61**. When a release changes this page, its [changelog](/core/2/guides/changelog) says so.

## How to read this page

| Level | Meaning |
|---|---|
| **Supported** | Kuzzle is meant to run on it. A bug that only shows up there is fixed like any other bug. |
| **Tested by the CI** | Kuzzle's test suites run on it for every change. It is the safest choice. |
| **Works, not supported** | Kuzzle's functional tests passed on it once, but the CI does not run on it, and its own maintainers no longer support it. Use it to plan an upgrade, not to stay on. |

## Node.js

| Node.js | Status | Tested by the CI |
|---|---|---|
| 22 (22.12 or later) | Supported | 22 |
| 24 | Supported | 24 (also the Node.js of the official `kuzzleio/kuzzle` Docker image) |
| 25 and later | Not supported (`npm install` warns about it) | |

## Operating systems

Kuzzle uses native (C++) dependencies. They ship prebuilt for:

- Linux x64 and arm64, with glibc 2.31 or later (e.g. Debian bullseye and later, Ubuntu 20.04 and later);
- macOS.

On those systems, `npm install kuzzle` needs no compiler. On Alpine Linux (musl) or other architectures, the native dependencies are compiled at install time, which needs `python3`, `make` and a C++ compiler such as `g++`.

## Storage engines

Kuzzle stores its data through a [storage driver](/core/2/guides/main-concepts/data-storage#storage-drivers). The Elasticsearch 7 and 8 drivers are built in, the others are installed next to Kuzzle. Each driver refuses to start on an engine version it does not support.

| Engine | Driver | Supported versions | Tested by the CI | Kuzzle |
|---|---|---|---|---|
| Elasticsearch 7 | built in (`kuzzle-storage-es-7`) | 7.x | 7.17 | all 2.x |
| Elasticsearch 8 | built in (`kuzzle-storage-es-8`) | 8.x | 8.17 | 2.30 or later |
| Elasticsearch 9 | [`kuzzle-storage-es-9`](/drivers/storage-es-9/1/getting-started) | 9.x | 9.5 | 2.61 or later |
| OpenSearch 2 | [`kuzzle-storage-opensearch-2`](/drivers/storage-opensearch-2/1/getting-started) | 2.19 or a later 2.x | 2.19 | 2.61 or later |
| OpenSearch 3 | [`kuzzle-storage-opensearch-3`](/drivers/storage-opensearch-3/1/getting-started) | 3.x | 3.9 | 2.61 or later |

Elasticsearch 7 is the default. To pick another engine, see [Storage Drivers](/core/2/guides/main-concepts/data-storage#storage-drivers).

## Cache: Redis and Valkey

Kuzzle keeps its internal cache (authentication tokens, cluster state, locks) and the [memory storage](/core/2/api/controllers/memory-storage) in a Redis-compatible server. [Valkey](https://valkey.io), the open source fork of Redis, works the same way: point Kuzzle at it as you would at Redis, with the same configuration.

| Server | Supported versions | Tested by the CI | Works, not supported |
|---|---|---|---|
| Redis | 6.2, 7.x and 8.x | 6.2 and 8 | 4.0 and 5.0 |
| Valkey | 7.2, 8.x and 9.x | 9 | |

Every version in this table passed Kuzzle 2.61's functional tests on 2026-11-05: Redis 4.0, 5.0, 6.2, 7.2, 7.4 and 8, and Valkey 7.2, 8.1 and 9.1.

Some features need a recent server:

- an ACL user (`username` + `password`, see [Securing Redis](/core/2/guides/advanced/configuration#securing-redis)) needs Redis 6 or later, or any Valkey version.

Kuzzle needs no Redis module.

### Deployment modes

The CI runs on a single server. Kuzzle also connects to a Sentinel setup, to a Redis or Valkey cluster, and to managed services such as Amazon ElastiCache, Azure Cache for Redis or Google Memorystore, through the [ioredis](https://github.com/redis/ioredis) client options (see [Configuring Kuzzle](/core/2/guides/advanced/configuration)). These modes are supported, but not tested by the CI.

### On Valkey

[server:info](/core/2/api/controllers/server/info) describes the cache in `services.internalCache` and `services.memoryStorage`, with `type: "redis"` whichever server it runs on. Their `server` field tells which one answers (`redis` or `valkey`), and `version` is that server's own version, as in [server:capabilities](/core/2/api/controllers/server/capabilities). Kuzzle 2.61.0 and older have no `server` field, and give Valkey's version as `7.2.4`: the Redis version Valkey announces for compatibility.

The [memory storage](/core/2/api/controllers/memory-storage) only offers commands that both Redis and Valkey support. Plugins that send commands directly to the cache must check that their commands exist on the server they run on.
