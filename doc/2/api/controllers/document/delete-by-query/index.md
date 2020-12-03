---
code: true
type: page
title: deleteByQuery
---

# deleteByQuery

Deletes documents matching the provided search query.

Documents removed that way trigger real-time notifications.

## Limitations

The request fails if the number of documents returned by the search query exceeds the `documentsWriteCount` server configuration (see the [Configuring Kuzzle](/core/2/guides/advanced/configuration) guide).

This behavior aims at limiting the pressure on memory and on real-time notifications.

To remove a greater number of documents, you can:
 - change the server configuration
 - split the search query
 - use a paginated [document:search](/core/2/api/controllers/document/search) with [document:mDelete](/core/2/api/controllers/document/m-delete)
 - use [bulk:deleteByQuery](/core/2/api/controllers/bulk/delete-by-query)

To remove all documents from a collection, use [collection:truncate](/core/2/api/controllers/collection/truncate) instead.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_query[?refresh=wait_for][&source]
Method: DELETE
Body:
```

```js
{
  "query": {
    // ...
  }
}
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "deleteByQuery",
  "refresh": "wait_for",
  "body": {
    "query": {
      // ...
    }
  }
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

### Optional

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the deleted documents are removed from the search indexes
- `source`: if set to `true` Kuzzle will return each deleted document body in the response.
---

## Body properties

- `query`: documents matching this search query will be deleted. Uses the [ElasticSearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) syntax.

---

## Response

Returns an object containing information about the deleted documents:

- `ids`: an array containing the list of each deleted document identifier <DeprecatedBadge version="2.2.1"/>.
- `documents` an array of the deleted documents. These contain their respective contents if the `source` is set to `true`.

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "deleteByQuery",
  "requestId": "<unique request identifier>",
  "result": {
    "documents": [
     {
      "_id": "<deleted document unique identifier>",
      "_source": {
        // Document content, Present only if 'source' parameter is set to true.
      }
     }
    ],
    // Deprecated since 2.2.1, use the documents array instead.
    "ids": [
      "id 1",
      "id 2",
      "id ...",
      "id n"
    ]
  }
}
```
