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
URL: http://kuzzle:7512/<index>/<collection>/<documentId>[?refresh=wait_for]
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

---

## Response

Returns an `_id` property with the deleted document unique ID.

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
    "_id": "<documentId>"
  }
}
```
