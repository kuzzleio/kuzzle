---
code: true
type: page
title: deleteByQuery | API | Core
---

# deleteByQuery

Deletes documents matching the provided search query. 

This is a low level route intended to bypass Kuzzle actions on document deletion, notably:
  - check document write limit
  - trigger [realtime notifications](/core/2/guides/main-concepts/realtime-engine)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_bulk/_query[?refresh=wait_for]
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

---

## Body properties

- `query`: documents matching this search query will be deleted. Uses the [ElasticSearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) syntax.

---

## Response

Returns the number of deleted documents.

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "bulk",
  "action": "deleteByQuery",
  "requestId": "<unique request identifier>",
  "result": {
    "deleted": 42
  }
}
```
