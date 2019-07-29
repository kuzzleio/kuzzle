---
code: true
type: page
title: mCreate
---

# mCreate



Creates multiple documents.

If a document identifier already exists, the creation fails for that document.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_mCreate[?refresh=wait_for]
Method: POST
Body:
```

```js
{
  "documents": [
    {
      // Optional. If not provided, will be generated automatically.
      "_id": "<documentId>",
      "body": {
        // document content
      }
    },
    {
      // Optional. If not provided, will be generated automatically.
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
  "action": "mCreate",
  "body": {
    "documents": [
      {
        // Optional. If not provided, will be generated automatically.
        "_id": "<documentId>",
        "body": {
          "document": "body"
        }
      },
      {
        // Optional. If not provided, will be generated automatically.
        "_id": "<anotherDocumentId>",
        "body": {
          "document": "body"
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

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the newly created documents are indexed

---

## Body properties

- `documents`: an array of object. Each object describes a document to create, by exposing the following properties:
  - `_id` (optional): document identifier. If not provided, an unique identifier is automatically attributed to the new document
  - `body`: document content

---

## Response

Returns a `hits` array, containing the list of created documents, in the same order than the one provided in the query.

Each created document is an object with the following properties:

- `_id`: created document unique identifier
- `_source`: document content
- `_version`: version of the created document (should be `1`)
- `created`: a boolean telling whether a document is created (should be `true`)

If one or more document changes fail, the response status is set to `206`, and the `error` object contain a [partial error](/core/1/api/essentials/errors/#partialerror) error.

### Example

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "action": "mCreate",
  "controller": "document",
  "requestId": "<unique request identifier>",
  "result": {
    "hits": [
      {
        "_id": "<documentId>",
        "_source": {
          // document content
        },
        "_version": 1,
        "created": true
      },
      {
        "_id": "<anotherDocumentId>",
        "_source": {
          "// document content
        "_version": 1,
        "created": true
      }
    ],
    "total": 2
  }
}
```
