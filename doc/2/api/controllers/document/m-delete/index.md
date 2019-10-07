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

Returns an object containing 2 arrays: `successes` and `errors`

The `successes` array contain the successfuly deleted document IDs.

Each deletion error is an object of the `errors` array with the following properties:
- `id`: document ID
- `reason`: human readable reason

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "action": "mDelete",
  "controller": "document",
  "requestId": "<unique request identifier>",
  "result": {
    "successes": ["<documentId>"],
    "errors": [
      { 
        "id": "anotherDocumentId", 
        "reason": "cannot find document" 
      }
    ]
  }
}
```
