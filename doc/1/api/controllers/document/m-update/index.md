---
code: true
type: page
title: mUpdate
---

# mUpdate



Updates multiple documents.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_mUpdate[?refresh=wait_for][&retryOnConflict=<retries>]
Method: PUT
Body:
```

```js
{
  "documents": [
    {
      "_id": "<documentId>",
      "body": {
        // document changes
      }
    },
    {
      "_id": "<anotherDocumentId>",
      "body": {
        // document changes
      }
    }
  ]
}
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "mUpdate",
  "body": {
    "documents": [
      {
        "_id": "<documentId>",
        "body": {
          // document changes
        }
      },
      {
        "_id": "<anotherDocumentId>",
        "body": {
          // document changes
        }
      }
    ]
  }
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the updates are indexed
- `retryOnConflict`: conflicts may occur if the same document gets updated multiple times within a short timespan in a database cluster. You can set the `retryOnConflict` optional argument (with a retry count), to tell Kuzzle to retry the failing updates the specified amount of times before rejecting the request with an error.

---

## Body properties

- `documents`: an array of object. Each object describes a document to update, by exposing the following properties:
  - `_id` : ID of the document to replace
  - `body`: partial changes to apply to the document

---

## Response

Returns a `hits` array containing the list of updated documents.

Each document has the following properties:

- `_id`: document unique identifier
- `_source`: updated document content
- `_version`: version number of the document

If one or more document cannot be updated, the response status is set to `206`, and the `error` object contain a [partial error](/core/1/api/essentials/errors/#partialerror) error.

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "action": "mUpdate",
  "controller": "document",
  "requestId": "<unique request identifier>",
  "result": {
    "hits": [
      {
        "_id": "<documentId>",
        "_version": 2,
        "_source": {
          // updated document content
        }
      },
      {
        "_id": "<anotherDocumentId>",
        "_version": 4,
        "_source": {
          // updated document content
        }
      }
    ],
    "total": 2
  }
}
```
