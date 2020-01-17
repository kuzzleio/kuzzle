---
code: true
type: page
title: updateByQuery
---

# updateByQuery

Updates documents matching the provided search query. 

Documents updated that way trigger real-time notifications.

## Limitations

The request fails if the number of documents returned by the search query exceeds the `documentsWriteCount` server configuration (see the [Configuring Kuzzle](/core/2/guides/essentials/configuration) guide).

To update a greater number of documents, either change the server configuration, or split the search query.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_query
Method: POST
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
  "action": "updateByQuery",
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

---

## Body properties

- `query`: documents matching this search query will be deleted. Uses the [ElasticSearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) syntax.

---

## Response

Returns a `ids` array containing the list of deleted document identifiers.

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "updateByQuery",
  "requestId": "<unique request identifier>",
  "result": {
    "ids": [
      "id 1",
      "id 2",
      "id ...",
      "id n"
    ]
  }
}
```
