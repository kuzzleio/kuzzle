---
code: false
type: page
title: Document Metadata
order: 450
---

# Document Metadata

Whenever a document is created, updated or deleted, Kuzzle will add or update the document's metadata. This metadata provides information about the document's lifecycle.

::: info
You can bypass metadata automatic creation by using [bulk:write](/core/2/api/controllers/bulk/write) or [bulk:mWrite](/core/2/api/controllers/bulk/m-write) actions.
:::

---

## Overview

<SinceBadge version="1.3.0" />

Metadata can be viewed in the document's `_kuzzle_info` field and contains the following properties:

- `author`: The [unique identifier](/core/2/guides/essentials/user-authentication#kuzzle-user-identifier-kuidd) of the user who created the document.
- `collection`: The name of the collection the document is in.
- `createdAt`: Timestamp of document creation (create or replace), in epoch-milliseconds format.
- `index`: The name of the index the document is in.
- `updatedAt`: Timestamp of last document update in epoch-milliseconds format, or `null` if no update has been made.
- `updater`: The [unique identifier](/core/2/guides/essentials/user-authentication#kuzzle-user-identifier-kuid) of the user that updated the document, or `null` if the document has never been updated.

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
      "collection": "<collection>",
      "createdAt": 1481816934209,
      "index": "<index>",
      "updatedAt": null,
      "updater": null
    }
  }
}
```

---

## How metadata are physically stored

Documents metadata are managed by Kuzzle and cannot be changed using the API (except with [bulk:write](/core/2/api/controllers/bulk/write) and [bulk:mWrite](/core/2/api/controllers/bulk/m-write)).
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
