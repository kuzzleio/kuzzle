---
code: false
type: page
order: 410
title: Kuzzle 2.59 | Changelog | Guide | Core
meta:
  - name: description
    content: What Kuzzle 2.59 changes, in plain words
  - name: keywords
    content: Kuzzle, Documentation, changelog, 2.59, collection lock
---

# Kuzzle 2.59

**Released:** 2026-10-01. [GitHub release](https://github.com/kuzzleio/kuzzle/releases/tag/v2.59.0).

## In short

2.59 adds two building blocks for maintenance tools that rebuild a collection while Kuzzle keeps running, such as a mapping migration. Nothing changes if you don't use them.

## What you need to do

Nothing.

## What's new

- **Collection write locks.** A collection can be locked for writing across the whole cluster. While it is locked, every write on it (document writes, bulk imports, mapping updates, truncate, delete) is refused with the new [`services.storage.collection_locked`](/core/2/api/errors/error-codes/services) error (`503`), and reads keep working. Only server-side code can lock a collection: there is no API action for it.
- **Unmanaged indices** (Elasticsearch 8). An Elasticsearch index that carries the `kuzzle-unmanaged` alias is ignored by Kuzzle's startup repairs and its storage statistics. A tool can build a collection's next index beside it without Kuzzle mistaking it for a collection.
