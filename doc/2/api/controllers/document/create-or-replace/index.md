---
code: true
type: page
title: createOrReplace
---

# createOrReplace



Creates a new document in the persistent data storage, or replaces its content if it already exists.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/<documentId>[?refresh=wait_for][&silent]
Method: PUT
Body:
```

```js
{
  // Document content
}
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "createOrReplace",
  "_id": "<documentId>",
  "body": {
    // document content
  }
}
```

---

## Arguments

- `collection`: collection name
- `documentId`: unique identifier of the document to create or replace
- `index`: index name

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the created/replaced document is indexed
- `silent`: if set, then Kuzzle will not generate notifications

---

## Body properties

New document content.

---

## Response

Returns an object with the following properties:

- `_id`: created document unique identifier
- `_source`: document content
- `_version`: version of the created document
- `created`: a boolean telling if a new document has been created

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "createOrReplace",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<documentId>",
    "_source": {
      // document content
    },
    "_version": 1,
    "created": true
  }
}
```
