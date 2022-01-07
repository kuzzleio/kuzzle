---
code: true
type: page
title: mExists
---

# mExists

Check if multiple documents exists.

::: info
The number of documents that can be fetched by a single request is limited by the `documentsFetchCount` server configuration (see the [Configuring Kuzzle](/core/2/guides/advanced/configuration) guide).
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_mExists
Method: POST
Body:
```

```js
{
  "ids": ["<documentId>", "<anotherDocumentId>"]
}
```

You can also access this route with the `GET` verb:

```http
URL: http://kuzzle:7512/<index>/<collection>/_mExists?ids=documentId,anotherDocumentId
Method: GET
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "mExists",
  "body": {
    "ids": ["<documentId>", "<anotherDocumentId>"]
  }
}
```

### Kourou

```bash
kourou document:mExists <index> <collection> <body>
```

---

## Arguments

- `collection`: collection name
- `index`: index name

### Optional:

- `strict`: if set, an error will occur if any of the documents does not exists

---

## Body properties

- `ids`: an array of document identifiers to fetch

---

## Response

Returns an object containing 2 arrays: `successes` and `errors`

The `successes` array contain the list of retrieved documents.

Each document is an object with the following properties:

- `_id`: document unique identifier
- `_source`: document content
- `_version`: version number of the document

The `errors` array contain the IDs of not found documents.

If `strict` mode is enabled, will rather return an error if at least one document could not been retreived.

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "action": "mExists",
  "controller": "document",
  "requestId": "<unique request identifier>",
  "result": {
    "successes": [
      {
        "_id": "<documentId>",
        "_source": {
          // document content
        },
        "_version": 4
      },
      {
        "_id": "<anotherDocumentId>",
        "_source": {
          // document content
        },
        "_version": 2
      }
    ]
    "errors": ["<anotherDocumentId>"]
  }
}
```
