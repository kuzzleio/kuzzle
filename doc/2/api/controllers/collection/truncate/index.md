---
code: true
type: page
title: truncate
---

# truncate

Empties a collection by removing all its documents, while keeping any associated mapping.

::: info
This action delete then recreate the related Elasticsearch index.
Please note that deleting/creating an index cannot be done concurrently within an Elasticsearch cluster, if you need to truncate a lot of collections (for your functional tests for example), then you should use `collection:refresh` and `document:deleteByQuery`
:::

::: warning
Documents removed that way do not trigger real-time notifications.
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_truncate
Method: DELETE
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "collection",
  "action": "truncate"
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

---

## Response

Returns a confirmation that the collection is being emptied:

```js
{
  "status": 200,
  "error": null,
  "action": "truncate",
  "controller": "collection",
  "index": "<index>",
  "collection": "<collection>",
  "requestId": "<unique request identifier>",
  "result": {
    "acknowledged": true,
  }
}
```

---

## Possible errors

- [Common errors](/core/2/api/errors/types#common-errors)
- [NotFoundError](/core/2/api/errors/types#notfounderror)

