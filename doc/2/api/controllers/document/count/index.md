---
code: true
type: page
title: count
---

# count

Counts documents in a collection.

A query can be provided to alter the count result, otherwise returns the total number of documents in the collection.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_count
Method: POST
Body:
```

```js
{
  "query": {
    "match_all": {}
  }
}
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "count",
  "body": {
    "query": {
      "match_all": {}
    }
  }
}
```

### Kourou

```bash
kourou document:count <index> <collection> <body>
```

---

## Arguments

- `collection`: collection name
- `index`: index name

---

## Body properties

### Optional:

- `query`: if provided, will count only documents matching this search query. Uses the [ElasticSearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/query-dsl.html) syntax.

---

## Response

Returns an object with the `count` property, an integer showing the number of documents matching the provided search query:

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "count",
  "requestId": "<unique request identifier>",
  "result": {
    "count": 42
  }
}
```
