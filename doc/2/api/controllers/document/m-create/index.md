---
code: true
type: page
title: mCreate
---

# mCreate

Creates multiple documents.

If a document identifier already exists, the creation fails for that document.

::: info
The number of documents that can be created by a single request is limited by the `documentsWriteCount` server configuration (see the [Configuring Kuzzle](/core/2/guides/advanced/8-configuration) guide).
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_mCreate[?refresh=wait_for]
Method: POST
Body:
```

```js
{
  "documents": [
    {
      // Optional. If not provided, will be generated automatically.
      "_id": "<documentId>",
      "body": {
        // document content
      }
    },
    {
      // Optional. If not provided, will be generated automatically.
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
  "action": "mCreate",
  "body": {
    "documents": [
      {
        // Optional. If not provided, will be generated automatically.
        "_id": "<documentId>",
        "body": {
          "document": "body"
        }
      },
      {
        // Optional. If not provided, will be generated automatically.
        "_id": "<anotherDocumentId>",
        "body": {
          "document": "body"
        }
      }
    ]
  }
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the newly created documents are indexed

---

## Body properties

- `documents`: an array of object. Each object describes a document to create, by exposing the following properties:
  - `_id` (optional): document identifier. If not provided, an unique identifier is automatically attributed to the new document
  - `body`: document content

---

## Response

Returns an object containing 2 arrays: `successes` and `errors`

Each created document is an object of the `successes` array with the following properties:

- `_id`: created document unique identifier
- `_source`: document content
- `_version`: version of the created document (should be `1`)
- `created`: a boolean telling whether a document is created (should be `true`)

Each errored document is an object of the `errors` array with the following properties:

- `document`: original document that caused the error
- `status`: HTTP error status code
- `reason`: human readable reason

### Example

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "action": "mCreate",
  "controller": "document",
  "requestId": "<unique request identifier>",
  "result": {
    "successes": [
      {
        "_id": "<documentId>",
        "_source": {
          // kuzzle metadata
          "_kuzzle_info": {
            "author": "<user kuid>",
            "createdAt": <creation timestamp>,
            "updatedAt": null,
            "updater": null
          },
          // document content
        },
        "result": "created",
        "status": 201,
        "_version": 1
      },
      {
        "_id": "<anotherDocumentId>",
        "_source": {
          // kuzzle metadata
          "_kuzzle_info": {
            "author": "<user kuid>",
            "createdAt": <creation timestamp>,
            "updatedAt": null,
            "updater": null
          },
          // document content
        },
        "result": "created",
        "status": 201,
        "_version": 1
      }
    ],
    "errors": [
      {
        "document": {
          "_id": "<document id>",
          "body": {
            // document content
          }
        },
        "reason": "document already exists",
        "status": 400
      }
    ]
  }
}
```
