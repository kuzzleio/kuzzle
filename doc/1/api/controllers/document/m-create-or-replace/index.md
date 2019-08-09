---
code: true
type: page
title: mCreateOrReplace
---

# mCreateOrReplace



Creates or replaces multiple documents.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_mCreateOrReplace[?refresh=wait_for]
Method: PUT
Body:
```

```js
{
  "documents": [
    {
      "_id": "<documentId>",
      "body": {
        // document content
      }
    },
    {
      "_id": "<anotherDocumentId>",
      "body": {
        // document content
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
  "action": "mCreateOrReplace",
  "body": {
    "documents": [
      {
        "_id": "<documentId>",
        "body": {
          // document content
        }
      },
      {
        "_id": "<anotherDocumentId>",
        "body": {
          // document content
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

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the created/replaced documents are indexed

---

## Body properties

- `documents`: an array of object. Each object describes a document to create or replace, by exposing the following properties:
  - `_id`: document unique identifier
  - `body`: document content

---

## Response

Returns a `hits` array, containing the list of created documents, in the same order than the one provided in the query.

Each created document is an object with the following properties:

- `_id`: created document unique identifier
- `_source`: document content
- `_version`: version number of the document
- `created`: a boolean telling whether a document is created

If one or more document creations fail, the response status is set to `206`, and the `error` object contain a [partial error](/core/1/api/essentials/errors#partialerror) error.

### Example

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "action": "mCreateOrReplace",
  "controller": "document",
  "requestId": "<unique request identifier>",
  "result": {
    "hits": [
      {
        "_id": "<documentId>",
        "_source": {
          // document content
        },
        "_version": 2,
        "created": false
      },
      {
        "_id": "<anotherDocumentId>",
        "_source": {
          // document content
        },
        "_version": 1,
        "created": true
      }
    ],
    "total": 2
  }
}
```
