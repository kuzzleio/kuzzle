---
code: true
type: page
title: mUpdate
---

# mUpdate

Updates multiple documents.

::: info
The number of documents that can be updated by a single request is limited by the `documentsWriteCount` server configuration (see the [Configuring Kuzzle](/core/2/guides/advanced/configuration) guide).
:::

---

## Query Syntax

### HTTP

<SinceBadge version="2.11.0"/>
```http
URL: http://kuzzle:7512/<index>/<collection>/_mUpdate[?refresh=wait_for][&retryOnConflict=<retries>][&silent]
Method: PATCH
Body:
```

<DeprecatedBadge version="2.11.0">
```http
URL: http://kuzzle:7512/<index>/<collection>/_mUpdate[?refresh=wait_for][&retryOnConflict=<retries>][&silent]
Method: PUT
Body:
```
</DeprecatedBadge>

```js
{
  "documents": [
    {
      "_id": "<documentId>",
      "body": {
        // document changes
      }
    },
    {
      "_id": "<anotherDocumentId>",
      "body": {
        // document changes
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
  "action": "mUpdate",
  "body": {
    "documents": [
      {
        "_id": "<documentId>",
        "body": {
          // document changes
        }
      },
      {
        "_id": "<anotherDocumentId>",
        "body": {
          // document changes
        }
      }
    ]
  }
}
```

### Kourou

```bash
kourou document:mUpdate <index> <collection> <body>
kourou document:mUpdate <index> <collection> <body> -a silent=true
```

---

## Arguments

- `collection`: collection name
- `index`: index name

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the updates are indexed
- `retryOnConflict`: conflicts may occur if the same document gets updated multiple times within a short timespan in a database cluster. You can set the `retryOnConflict` optional argument (with a retry count), to tell Kuzzle to retry the failing updates the specified amount of times before rejecting the request with an error.
- `silent`: if set, then Kuzzle will not generate notifications <SinceBadge version="2.9.2" />
- `strict`: if set, an error will occur if a document was not updated <SinceBadge version="2.11.0" />

---

## Body properties

- `documents`: an array of object. Each object describes a document to update, by exposing the following properties:
  - `_id` : ID of the document to replace
  - `body`: partial changes to apply to the document

---

## Response

Returns an object containing 2 arrays: `successes` and `errors`

Each updated document is an object of the `successes` array with the following properties:

- `_id`: document unique identifier
- `_source`: document content
- `_version`: updated document version
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
  "action": "mUpdate",
  "controller": "document",
  "requestId": "<unique request identifier>",
  "result": {
    "successes": [
      {
        "_id": "<documentId>",
        "status": 200,
        "_source": {
          // updated document content
        },
        "_version": 2
      },
      {
        "_id": "<anotherDocumentId>",
        "status": 200,
        "_source": {
          // updated document content
        },
        "_version": 2
      }
    ],
    "errors": [
      {
        "document": {
          // updated document content
        },
        "status": 404,
        "reason": "Document 'foobar' not found"
      }
    ]
  }
}
```
