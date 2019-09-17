---
code: true
type: page
title: mGet
---

# mGet

Gets multiple documents.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_mGet
Method: POST
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
  "action": "mGet",
  "body": {
    "ids": ["<documentId>", "<anotherDocumentId>"]
  }
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

---

## Body properties

- `ids`: an array of document identifiers to fetch

---

## Response

Returns a `hits` array with the list of retrieved documents.

Each document is an object with the following properties:

- `_id`: document unique identifier
- `_source`: document content
- `_version`: version number of the document

If one or more document retrievals fail, the response status is set to `206`, and the `error` object contain a [partial error](/core/2/api/essentials/errors#partialerror) error.

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "action": "mGet",
  "controller": "document",
  "requestId": "<unique request identifier>",
  "result": {
    "hits": [
      {
        "_id": "<documentId>",
        "_source": {
          // document content
        },
        "_version": 4
      },
      {
        "_id": "<anotherDocumentId>",
        "_source": {
          // document content
        },
        "_version": 2
      }
    ]
    "total": 2
  }
}
```
