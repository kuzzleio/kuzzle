---
code: true
type: page
title: mUpsert | API | Core
---

# mUpsert

<SinceBadge version="2.11.0"/>

Applies partial changes to multiple documents. If a document doesn't already exist, a new document is created.

::: info
The number of documents that can be updated by a single request is limited by the `documentsWriteCount` server configuration (see the [Configuring Kuzzle](/core/2/guides/advanced/configuration) guide).
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_mUpsert[?refresh=wait_for][&retryOnConflict=<retries>][&silent]
Method: POST
Body:
```

```js
{
  "documents": [
    {
      "_id": "<documentId>",
      "changes": {
        // document partial changes
      },
      "default": {
        // optional: document fields to add to the "update" part if the document
        // is created
      }
    },
    {
      "_id": "<anotherDocumentId>",
      "changes": {
        // document partial changes
      },
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
  "action": "mUpsert",
  "body": {
    "documents": [
      {
        "_id": "<documentId>",
        "changes": {
          // document partial changes
        },
        "default": {
          // optional: document fields to add to the "update" part if the document
          // is created
        }
      },
      {
        "_id": "<anotherDocumentId>",
        "changes": {
          // document partial changes
        },
      }
    ]
  }
}
```

### Kourou

```bash
kourou document:mUpsert <index> <collection> <body>
kourou document:mUpsert <index> <collection> <body> -a silent=true
```

---

## Arguments

- `collection`: collection name
- `index`: index name

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the updates are indexed
- `retryOnConflict`: conflicts may occur if the same document gets updated multiple times within a short timespan in a database cluster. You can set the `retryOnConflict` optional argument (with a retry count), to tell Kuzzle to retry the failing updates the specified amount of times before rejecting the request with an error.
- `silent`: if set, then Kuzzle will not generate notifications
- `strict`: if set, an error will occur if a document was not updated

---

## Body properties

- `documents`: an array of object. Each object describes a document to update, by exposing the following properties:
  - `_id` : ID of the document to replace
  - `changes`: partial changes to apply to the document
  - `default`: (optional) fields to add to the document if it gets created

---

## Response

Returns an object containing 2 arrays: `successes` and `errors`

Each updated document is an object of the `successes` array with the following properties:

- `_id`: document unique identifier
- `_source`: document content
- `_version`: updated document version
- `created`: if `true`, a new document was created, otherwise the document existed and was updated
- `status`: HTTP status code

Each errored document is an object of the `errors` array with the following properties:

- `document`: original document that caused the error
- `status`: HTTP error status code
- `reason`: human readable reason

If `strict` mode is enabled, will rather return an error if at least one document has not been updated.

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "action": "mUpsert",
  "controller": "document",
  "requestId": "<unique request identifier>",
  "result": {
    "successes": [
      {
        "_id": "<documentId>",
        "created": false,
        "status": 200,
        "_source": {
          // updated document content
        },
        "_version": 2
      },
      {
        "_id": "<anotherDocumentId>",
        "created": true,
        "status": 200,
        "_source": {
          // created document content
        },
        "_version": 2
      }
    ],
    "errors": [
      {
        "document": {
          // document content to update
        },
        "status": 400,
        "reason": "document changes must be an object"
      }
    ]
  }
}
```
