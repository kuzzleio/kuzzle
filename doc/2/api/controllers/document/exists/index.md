---
code: true
type: page
title: exists
---

# exists

<SinceBadge version="2.0.0"/>

Checks if a document exists.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/<_id>/_exists
Method: GET
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "exists",
  "_id": "<documentId>"
}
```

### Kourou

```bash
kourou document:exists <index> <collection> <id>
```

---

## Arguments

- `_id`: document unique identifier
- `collection`: collection name
- `index`: index name

---

## Response

Returns a boolean.

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "exists",
  "requestId": "<unique request identifier>",
  "result": true
}
```
