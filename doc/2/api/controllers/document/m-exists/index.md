---
code: true
type: page
title: mExists | API | Core
---

# mExists

<SinceBadge version="2.17.0"/>

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

Instead of a body, the identifiers can also be passed as a comma-separated list in the query string (there is no `GET` route for this action):

```http
URL: http://kuzzle:7512/<index>/<collection>/_mExists?ids=documentId,anotherDocumentId
Method: POST
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

The `successes` array contains the IDs of the existing documents.

The `errors` array contains the IDs of the documents that do not exist.

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
      "<documentId>",
      "<anotherDocumentId>"
    ],
    "errors": ["<missingDocumentId>"]
  }
}
```
