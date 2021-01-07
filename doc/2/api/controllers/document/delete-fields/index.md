---
code: true
type: page
title: delete-fields
---

# deleteFields



Delete fields of an existing document.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/<documentId>/_fields[?refresh=wait_for]
Method: DELETE
Body: {}
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
  "action": "replace",
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
- `documentId`: unique ID of the document to replace
- `index`: index name

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the new document content is indexed

---

## Body properties

- `fields`: an array of string. Each string represent a path (see lodash path) to a specific field to remove

---

## Response

Returns an object containing updated document information, with the following properties:

- `_id`: document unique identifier
- `_source`: new document content
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
