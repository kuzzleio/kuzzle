---
code: true
type: page
title: upsert
---

# upsert

<SinceBadge version="2.8.0"/>

Applies partial changes to a document. If the document doesn't already exist, a new document is created.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/<_id>/_upsert[?refresh=wait_for][&retryOnConflict=<int>][&source][&silent]
Method: PUT
Body:
```

```js
{
  changes: {
    // document partial changes
  },
  default: {
    // optional: document fields to add to the "update" part if the document
    // is created
  }
}
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "upsert",
  "_id": "<documentId>",
  "body": {
    "changes": {
      // document partial changes
    },
    "default": {
      // optional: document fields to add to the changes if the document
      // is created
    }
  }
}
```

---

## Arguments

- `_id`: unique identifier of the document to update
- `collection`: collection name
- `index`: index name

### Optional

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the document is indexed
- `retryOnConflict`: conflicts may occur if the same document gets updated multiple times within a short timespan, in a database cluster. You can set the `retryOnConflict` optional argument (with a retry count), to tell Kuzzle to retry the failing updates the specified amount of times before rejecting the request with an error.
- `source`: if set to `true` Kuzzle will return the entire updated document body in the response.
- `silent`: if set, then Kuzzle will not generate notifications

---

## Body properties

- `changes`: partial changes to apply to the document
- `default`: (optional) fields to add to the document if it gets created

---

## Response

Returns information about the updated document:

- `_id`: document unique identifier
- `_source`: (only if the `source` option is set) actualized document content
- `_version`: updated document version
- `created`: if `true`, a new document was created, otherwise the document existed and was updated

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "upsert",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<documentId>",
    "_source": {
      // (optional) actualized document content. This property appears only if
      // the "source" option is set to true
    },
    "_version": 2,
    "created": false,
  }
}
```
