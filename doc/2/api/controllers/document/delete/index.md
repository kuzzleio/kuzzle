---
code: true
type: page
title: delete | API | Core
---

# delete

Deletes a document.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/<documentId>[?refresh=wait_for][&source][&silent]
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

### Kourou

```bash
kourou document:delete <index> <collection> <id>
kourou document:delete <index> <collection> <id> -a silent=true
```

---

## Arguments

- `collection`: collection name
- `_id`: document unique identifier
- `index`: index name

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the deletion has been indexed
- `source`: if set to `true` Kuzzle will return the deleted document body in the response.
- `silent`: if set, then Kuzzle will not generate notifications <SinceBadge version="2.9.2" />

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
