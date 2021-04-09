---
code: true
type: page
title: mWrite
---

# mWrite

<SinceBadge version="1.8.0" />

Create or replace multiple documents directly into the storage engine.

This is a low level route intended to bypass Kuzzle actions on document creation, notably:
  - check document write limit <SinceBadge version="2.3.3" />
  - check [document validity](/core/2/guides/advanced/data-validation),
  - add [kuzzle metadata](/core/2/guides/main-concepts/data-storage#kuzzle-metadata),
  - trigger [realtime notifications](/core/2/guides/main-concepts/realtime-engine) (unless asked otherwise)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_mWrite[?refresh=wait_for][&notify]
Method: POST
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
  "controller": "bulk",
  "action": "mWrite",

  "notify": "<boolean>",
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

- `collection`: data collection
- `index`: data index

### Optional:

- `notify`: if set to true, Kuzzle will trigger realtime notifications
- `refresh`: if set to `wait_for`, Kuzzle will not respond until the created/replaced documents are indexed
- `strict`: if set, an error will occur if at least one document has not been created/replaced <SinceBadge version="2.11.0" />

---

## Body properties

- `documents`: an array of object. Each object describes a document to create or replace, by exposing the following properties:
  - `_id`: document unique identifier
  - `body`: document content

---

## Response

Returns an object containing 2 arrays: `successes` and `errors`

Each created or replaced document is an object of the `successes` array with the following properties:

- `_id`: document unique identifier
- `_source`: document content
- `_version`: version of the document (should be `1`)

Each errored document is an object of the `errors` array with the following properties:

- `document`: original document that caused the error
- `status`: HTTP error status code
- `reason`: human readable reason

If `strict` mode is enabled, will rather return an error if at least one document has not been created/replaced.

### Example

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "action": "mWrite",
  "controller": "bulk",
  "requestId": "<unique request identifier>",
  "result": {
    "successes": [
      {
        "_id": "<documentId>",
        "_source": {
          // document content
        },
        "_version": 2
      },
      {
        "_id": "<anotherDocumentId>",
        "_source": {
          // document content
        },
        "_version": 1
      }
    ],
    "errors": []
  }
}
```
