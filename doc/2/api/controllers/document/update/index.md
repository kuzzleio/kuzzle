---
code: true
type: page
title: update
---

# update

Applies partial changes to a document. The document must exist in the storage layer.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/<_id>/_update[?refresh=wait_for][&retryOnConflict=<int>][&source][&silent]
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

### Kourou

```bash
kourou document:update <index> <collection> <id> <body>
kourou document:update <index> <collection> <id> <body> -a silent=true
```


---

## Arguments

- `_id`: unique identifier of the document to update
- `collection`: collection name
- `index`: index name

### Optional

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the update is indexed
- `retryOnConflict`: conflicts may occur if the same document gets updated multiple times within a short timespan, in a database cluster. You can set the `retryOnConflict` optional argument (with a retry count), to tell Kuzzle to retry the failing updates the specified amount of times before rejecting the request with an error.
- `source`: if set to `true` Kuzzle will return the entire updated document body in the response.
- `silent`: if set, then Kuzzle will not generate notifications <SinceBadge version="2.9.2" />

---

## Body properties

Partial changes to apply to the document.

---

## Response

Returns information about the updated document:

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
