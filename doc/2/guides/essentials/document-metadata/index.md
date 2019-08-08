---
code: false
type: page
title: Document Metadata
order: 450
---

# Document Metadata

Whenever a document is created, updated or deleted, Kuzzle will add or update the document's metadata. This metadata provides information about the document's lifecycle.

::: info
You can bypass metadata automatic creation by using [bulk:write](/core/1/api/controllers/bulk/write) or [bulk:mWrite](/core/1/api/controllers/bulk/m-write) actions.
:::

---

## Overview

<DeprecatedBadge version="1.3.0" />

Metadata can be viewed in the document's `_meta` field and contains the following properties:

<SinceBadge version="1.3.0" />

Metadata can be viewed in the document's `_kuzzle_info` field and contains the following properties:

- `author`: The [unique identifier](/core/1/guides/essentials/user-authentication/#kuzzle-user-identifier-kuidd) of the user who created the document.
- `createdAt`: Timestamp of document creation (create or replace), in epoch-milliseconds format.
- `updatedAt`: Timestamp of last document update in epoch-milliseconds format, or `null` if no update has been made.
- `updater`: The [unique identifier](/core/1/guides/essentials/user-authentication/#kuzzle-user-identifier-kuid) of the user that updated the document, or `null` if the document has never been updated.
- `active` <DeprecatedBadge version="1.2.0" />: The status of the document. `true` if the document is active and `false` if the document has been put in the trashcan.
- `deletedAt`<DeprecatedBadge version="1.2.0" />: Timestamp of document deletion in epoch-milliseconds format, or `null` if the document has not been deleted.

Here is an example of a Kuzzle response, containing a document's `_id`, `_source` and `_meta` fields:

<DeprecatedBadge version="1.3.0" />

```json
{
  "_index": "myindex",
  "_type": "mycollection",
  "_id": "AVkDLAdCsT6qHI7MxLz4",
  "_score": 0.25811607,
  "_source": {
    "message": "Hello World!"
  },
  "_meta": {
    "author": "<kuid>",
    "createdAt": 1481816934209,
    "updatedAt": null,
    "updater": null,
    "active": true,
    "deletedAt": null
  }
}
```

<SinceBadge version="1.3.0" />

Here is an example of a Kuzzle response, containing a document's `_id` and `_source` fields:

```json
{
  "_index": "myindex",
  "_type": "mycollection",
  "_id": "AVkDLAdCsT6qHI7MxLz4",
  "_score": 0.25811607,
  "_source": {
    "message": "Hello World!",
    "_kuzzle_info": {
      "author": "<kuid>",
      "createdAt": 1481816934209,
      "updatedAt": null,
      "updater": null,
      "active": true,
      "deletedAt": null
    }
  }
}
```

---

## How metadata are physically stored

Documents metadata are managed by Kuzzle and cannot be changed using the API (except with [bulk:write](/core/1/api/controllers/bulk/write) and [bulk:mWrite](/core/1/api/controllers/bulk/m-write)).
Metadata are stored in the `_kuzzle_info` field of each document in Elasticsearch.

Elasticsearch might contain documents that don't have metadata. This can be the case for documents that were not inserted through Kuzzle. Such documents will automatically obtain metadata when they are updated through Kuzzle.

---

## Querying Metadata

Kuzzle allows search requests to access metadata directly. This means that you'll have to search in the `_kuzzle_info` document property.

For example, to query by a document's creation timestamp, we can use the following search filter:

```json
{
  "query": {
    "range": {
      "_kuzzle_info.createdAt": {
        "lte": 1481816930000
      }
    }
  }
}
```

---

## Documents Deletion

<DeprecatedBadge version="1.2.0" />

When a document gets deleted, Kuzzle first isolates it from other active documents by placing it in the `trashcan`.

Documents in the `trashcan` cannot be accessed, searched or counted, unless the `includeTrash` flag is set to `true` when invoking the API route.

---

## Garbage Collection

<DeprecatedBadge version="1.2.0" />

Kuzzle will routinely search and permanently delete the oldest documents in the `trashcan`. This garbage collecting can be configured using the `services.garbageCollector` property in the Kuzzle [configuration file](/core/1/guides/essentials/configuration/). In general, garbage collection works as follows:

- When Kuzzle is started, it will check the `services.garbageCollector` property and wait the configured delay before running the garbage collection for the first time.
- If Kuzzle is in [overload](/core/1/plugins/guides/events/core-overload) the garbage collecting will be postponed until the load is reduced.
