---
code: true
type: page
title: deleteFields
description: Deletes fields of an existing document.
---

# deleteFields

Deletes fields of an existing document.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/<documentId>/_fields[?refresh=wait_for][&silent]
Method: DELETE
Body:
```

```js
{
  "fields": [
    // path of fields to remove
  ]
}
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "deleteFields",
  "_id": "<documentId>",
  "refresh": "wait_for",
  "body": {
    "fields": [
      // path of fields to remove
    ]
  }
}
```

---

## Arguments

- `collection`: collection name
- `documentId`: unique ID of the document where the fields should be removed
- `index`: index name

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the new document content is indexed
- `source`: if set to `true`, the response will contain the new updated document
- `silent`: if set, then Kuzzle will not generate notifications <SinceBadge version="2.9.2" />

---

## Body properties

- `fields`: an array of strings. Each string represents a path (see [lodash path](https://lodash.com/docs/4.17.15#toPath)) to a specific field to remove

---

## Response

Returns an object containing updated document information, with the following properties:

- `_id`: document unique identifier
- `_source`: the new document content, if `source` is set to `true`
- `_version`: updated document version number

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "replace",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<documentId>",
    "_source": {
      // new document content
    },
    "_version": 13
  }
}
```
