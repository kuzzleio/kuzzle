---
code: true
type: page
title: deleteByQuery
---

# deleteByQuery



Deletes documents matching the provided search query.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_query
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

- `query`: documents matching this search query will be deleted. Uses the [ElasticSearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/7.3/query-dsl.html) syntax.

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
  "action": "deleteByQuery",
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
