---
code: true
type: page
title: get | API | Core
---

# get

Gets a document.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/<documentId>
Method: GET
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "get",
  "_id": "<documentId>"
}
```

### Kourou

```bash
kourou document:get <index> <collection> <id>
```

---

## Arguments

- `collection`: collection name
- `documentId`: document unique identifier
- `index`: index name

---

## Response

Returns an object with the following properties:

- `_id`: document unique identifier
- `_source`: document content
- `_version`: document version

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "get",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<documentId>",
    "_version": 1,
    "_source": {
      "name": {
        "first": "Steve",
        "last": "Wozniak"
      },
      "hobby": "Segway polo",
      "_kuzzle_info": {
        "author": "Bob",
        "createdAt": 1481816934209,
        "updatedAt": null,
        "updater": null
      }
    }
  }
}
```
