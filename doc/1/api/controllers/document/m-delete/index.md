---
code: true
type: page
title: mDelete
---

# mDelete



Deletes multiple documents.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_mDelete[?refresh=wait_for]
Method: DELETE
Body:
```

```js
{
  "ids": ["<documentId>", "<anotherDocumentId>"]
}
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "mDelete",
  "body": {
    "ids": ["<documentId>", "<anotherDocumentId>"]
  }
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the deletions are indexed

---

## Body properties

- `ids`: an array of document identifiers to delete

---

## Response

Returns an array with the list of successfully deleted document identifiers.

If one or more document deletions fail, the response status is set to `206`, and the `error` object contain a [partial error](/core/1/api/essentials/errors/handling#partialerror) error.

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "action": "mDelete",
  "controller": "document",
  "requestId": "<unique request identifier>",
  "result": [
    "<documentId>",
    "<anotherDocumentId>"
  ]
}
```
