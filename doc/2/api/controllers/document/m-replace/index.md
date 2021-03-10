---
code: true
type: page
title: mReplace
---

# mReplace

Replaces multiple documents.

::: info
The number of documents that can be replaced by a single request is limited by the `documentsWriteCount` server configuration (see the [Configuring Kuzzle](/core/2/guides/advanced/configuration) guide).
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_mReplace[?refresh=wait_for][&silent]
Method: PUT
Body:
```

```js
{
  "documents": [
    {
      "_id": "<documentId>",
      "body": {
        // new document content
      }
    },
    {
      "_id": "<anotherDocumentId>",
      "body": {
        // new document content
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
  "action": "mReplace",
  "body": {
    "documents": [
      {
        "_id": "<documentId>",
        "body": {
          // new document content
        }
      },
      {
        "_id": "<anotherDocumentId>",
        "body": {
          // new document content
        }
      }
    ]
  }
}
```

### Kourou

```bash
kourou document:mReplace <index> <collection> <body>
kourou document:mReplace <index> <collection> <body> -a silent=true
```

---

## Arguments

- `collection`: collection name
- `index`: index name
- `silent`: if set, then Kuzzle will not generate notifications <SinceBadge version="2.9.2" />

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the replacements are indexed

---

## Body properties

- `documents`: an array of object. Each object describes a document to replace, by exposing the following properties:
  - `_id` : ID of the document to replace
  - `body`: document content

---

## Response

Returns an object containing 2 arrays: `successes` and `errors`

Each replaced document is an object of the `successes` array with the following properties:

- `_id`: document unique identifier
- `_source`: document content
- `_version`: version of the document (should be `1`)

Each errored document is an object of the `errors` array with the following properties:

- `document`: original document that caused the error
- `status`: HTTP error status code
- `reason`: human readable reason

::: warning
Errored documents are not guaranteed to be in the same orded as in the initial request.
:::

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "action": "mReplace",
  "controller": "document",
  "requestId": "<unique request identifier>",
  "result": {
    "successes": [
      {
        "_id": "<documentId>",
        "_source": {
          // new document content
        },
        "_version": 2
      },
      {
        "_id": "<anotherDocumentId>",
        "_source": {
          // new document content
        },
        "_version": 4
      }
    ],
    "errors": [
      {
        "document": {
          // new document content
        },
        "status": 404,
        "reason": "Document 'foobar' not found"
      }
    ]

  }
}
```
