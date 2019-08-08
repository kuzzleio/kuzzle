---
code: true
type: page
title: mReplace
---

# mReplace



Replaces multiple documents.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_mReplace[?refresh=wait_for]
Method: PUT
Body:
```

```js
{
  "documents": [
    {
      "_id": "<documentId>",
      "body": {
        // new document content
      }
    },
    {
      "_id": "<anotherDocumentId>",
      "body": {
        // new document content
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
  "action": "mReplace",
  "body": {
    "documents": [
      {
        "_id": "<documentId>",
        "body": {
          // new document content
        }
      },
      {
        "_id": "<anotherDocumentId>",
        "body": {
          // new document content
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

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the replacements are indexed

---

## Body properties

- `documents`: an array of object. Each object describes a document to replace, by exposing the following properties:
  - `_id` : ID of the document to replace
  - `body`: document content

---

## Response

Returns a `hits` array containing the list of replaced documents.

Each document has the following properties:

- `_id`: document unique identifier
- `_source`: document content
- `_version`: version number of the document

If one or more document cannot be replaced, the response status is set to `206`, and the `error` object contain a [partial error](/core/1/api/essentials/errors/#partialerror) error.

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "action": "mReplace",
  "controller": "document",
  "requestId": "<unique request identifier>",
  "result": {
    "hits": [
      {
        "_id": "<documentId>",
        "_source": {
          // new document content
        },
        "_version": 2
      },
      {
        "_id": "<anotherDocumentId>",
        "_source": {
          // new document content
        },
        "_version": 4
      }
    ],
    "total": 2
  }
}
```
