---
code: true
type: page
title: updateByQuery | API | Core
---

# updateByQuery

<SinceBadge version="2.11.0"/>

Updates documents matching the provided search query. 

This is a low level route intended to bypass Kuzzle actions on document update, notably:
  - Check document write limit
  - Inject [Kuzzle metadata](/core/2/guides/main-concepts/data-storage/#kuzzle-metadata)
  - Trigger [realtime notifications](/core/2/guides/main-concepts/realtime-engine)

::: info
Under the hood, this action uses Elastic Search [scripting feature](https://www.elastic.co/guide/en/elasticsearch/reference/current/modules-scripting-using.html).
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_bulk/_query[?refresh=wait_for]
Method: PATCH
Body:
```

```js
{
  "query": {
    // query to match documents
  },
  "changes": {
    // documents changes
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
  "refresh": "wait_for",
  "body": {
    "query": {
      // to match documents
    },
    "changes": {
      // documents changes
    }
  }
}
```

### Kourou

```bash
kourou document:updateByQuery <index> <collection> <body>
```

---

## Arguments

- `collection`: collection name
- `index`: index name

### Optional

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the deleted documents are removed from the search indexes

---

## Body properties

- `query`: documents matching this search query will be updated. Uses the [ElasticSearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) syntax.
- `changes`: partial changes to apply to the documents

::: warning
Even though `changes` supports deeply nested fields, there are some limitations. Therefore, you will not be able to apply partial changes to an array and will need to replace the whole array.
::: 

---

## Response

Returns the number of updated documents.


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
    "updated": 42
}
```
