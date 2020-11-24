---
code: true
type: page
title: write
---

# write

<SinceBadge version="1.8.0" />

Create or replace a document directly into the storage engine.

This is a low level route intended to bypass Kuzzle actions on document creation, notably:
  - check [document validity](/core/2/guides/essentials/data-validation),
  - add [kuzzle metadata](/core/2/guides/essentials/document-metadata),
  - trigger [realtime notifications](/core/2/guides/essentials/real-time) (unless asked otherwise).

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_write[?refresh=wait_for][&notify][&_id=<document ID>]
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
  "controller": "bulk",
  "action": "write",

  "_id": "<documentId>",
  "notify": "<boolean>",
  "body": {
    // document content
  }
}
```

---

## Arguments

- `collection`: data collection
- `index`: data index

### Optional:

- `_id`: set the document unique ID to the provided value, instead of auto-generating a random ID
- `notify`: if set to true, Kuzzle will trigger realtime notifications
- `refresh`: if set to `wait_for`, Kuzzle will not respond until the newly created document is indexed

---

## Body properties

Document content to create.

---

## Response

Returns an object with the following properties:

- `_id`: created document unique identifier
- `_source`: document content
- `_version`: version of the created document

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "bulk",
  "action": "write",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<documentId>",
    "_version": 1,
    "_source": {
      // document content
    },
  }
}
```
