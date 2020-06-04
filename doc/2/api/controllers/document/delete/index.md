---
code: true
type: page
title: delete
---

# delete



Deletes a document.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/<documentId>[?refresh=wait_for][&source]
Method: DELETE
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "delete",
  "_id": "<documentId>"
}
```

---

## Arguments

- `collection`: collection name
- `documentId`: document unique identifier
- `index`: index name

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the deletion has been indexed
- `source`: if set to `true` Kuzzle will return the deleted document body in the response.
---

## Response

Returns information about the deleted document:

- `_id`: document unique identifier
- `_source`: deleted document source, only if option `source` is set to `true`

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "delete",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<documentId>",
    "_source": "<deleted document>" // If `source` option is set to true
  }
}
```
