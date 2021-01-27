---
code: true
type: page
title: create
---

# create



Creates a new document in the persistent data storage.

Returns an error if the document already exists.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_create[?refresh=wait_for][&silent]
URL(2): http://kuzzle:7512/<index>/<collection>/<documentId>/_create[?refresh=wait_for][&silent]
Method: POST
Body:
```

```js
{
  // document content
}
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "create",
  "_id": "<documentId>",
  "body": {
    // document content
  }
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

### Optional:

- `documentId`: set the document unique ID to the provided value, instead of auto-generating a random ID
- `refresh`: if set to `wait_for`, Kuzzle will not respond until the newly created document is indexed
- `silent`: if set, then Kuzzle will not generate notifications

---

## Body properties

Document content to create.

---

## Response

Returns an object with the following properties:

- `_id`: created document unique identifier
- `_source`: document content
- `_version`: version of the created document (should be `1`)

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "create",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<documentId>",
    "_version": 1,
    "_source": {
      // ...
    },
  }
}
```
