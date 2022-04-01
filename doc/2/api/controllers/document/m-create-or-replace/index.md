---
code: true
type: page
title: mCreateOrReplace
---

# mCreateOrReplace

Creates or replaces multiple documents.

::: info
The number of documents that can be created or replaced by a single request is limited by the `documentsWriteCount` server configuration (see the [Configuring Kuzzle](/core/2/guides/advanced/configuration) guide).
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_mCreateOrReplace[?refresh=wait_for][&silent][&_source]
Method: PUT
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
  "controller": "document",
  "action": "mCreateOrReplace",
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

### Kourou

```bash
kourou document:mCreateOrReplace <index> <collection> <body>
kourou document:mCreateOrReplace <index> <collection> <body> -a silent=true
```

---

## Arguments

- `collection`: collection name
- `index`: index name

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the created/replaced documents are indexed
- `silent`: if set, then Kuzzle will not generate notifications <SinceBadge version="2.9.2" />
- `strict`: if set, an error will occur if at least one document has not been created/replaced <SinceBadge version="2.11.0" />
- `_source`: if set, at true, the response will contain the _source field of the created/replaced documents (default true) <SinceBadge version="auto-version"/>

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
- `created`: a boolean telling whether a document is created (should be `true`)

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
  "action": "mCreateOrReplace",
  "controller": "document",
  "requestId": "<unique request identifier>",
  "result": {
    "successes": [
      {
        "_id": "<documentId>",
        "_source": {
          // document content
        },
        "_version": 2,
        "created": true
      },
      {
        "_id": "<anotherDocumentId>",
        "_source": {
          // document content
        },
        "_version": 1,
        "created": false
      }
    ],
    "errors": [
      {
        "document": {
          // document content
        },
        "status": 400,
        "reason": "Missing document body"
      }
    ]

  }
}
```
