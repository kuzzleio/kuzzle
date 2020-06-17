---
code: true
type: page
title: update
---

# update



Updates a document content.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/<documentId>/_update[?refresh=wait_for][&retryOnConflict=<int>][&source]
Method: PUT
Body:
```

```js
{
  // document changes
}
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "update",
  "_id": "<documentId>",
  "body": {
    // document changes
  }
}
```

---

## Arguments

- `collection`: collection name
- `documentId`: unique identifier of the document to update
- `index`: index name

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the update is indexed
- `retryOnConflict`: conflicts may occur if the same document gets updated multiple times within a short timespan, in a database cluster. You can set the `retryOnConflict` optional argument (with a retry count), to tell Kuzzle to retry the failing updates the specified amount of times before rejecting the request with an error.
- `source`: if set to `true` Kuzzle will return the entire updated document body in the response.
---

## Body properties

Partial changes to apply to the document.

---

## Response

Returns information about the updated documents:

- `_id`: document unique identifier
- `_version`: updated document version
- `_source`: contains only changes or the full document if `source` is set to `true`

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "update",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<documentId>",
    "_version": 2,
    "_source": "<partial or entire document>"
  }
}
```
