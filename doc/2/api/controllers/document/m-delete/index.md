---
code: true
type: page
title: mDelete
---

# mDelete

Deletes multiple documents.

::: info
The number of documents that can be deleted by a single request is limited by the `documentsWriteCount` server configuration (see the [Configuring Kuzzle](/core/2/guides/advanced/configuration) guide).
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_mDelete[?refresh=wait_for][&silent]
Method: DELETE
Body:
```

```js
{
  "ids": ["<documentId>", "<anotherDocumentId>"]
}
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "document",
  "action": "mDelete",
  "body": {
    "ids": ["<documentId>", "<anotherDocumentId>"]
  }
}
```

### Kourou

```bash
kourou document:mDelete <index> <collection> <body>
kourou document:mDelete <index> <collection> <body> -a silent=true
```

---

## Arguments

- `collection`: collection name
- `index`: index name

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the deletions are indexed
- `silent`: if set, then Kuzzle will not generate notifications <SinceBadge version="2.9.2" />
- `strict`: if set, an error will occur if at least one document has not been deleted <SinceBadge version="auto-version" />

---

## Body properties

- `ids`: an array of document identifiers to delete

---

## Response

Returns an object containing 2 arrays: `successes` and `errors`

The `successes` array contain the successfuly deleted document IDs.

Each deletion error is an object of the `errors` array with the following properties:
- `_id`: document ID
- `reason`: human readable reason

If `strict` mode is enabled, will rather return an error if at least one document has not been deleted.

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "action": "mDelete",
  "controller": "document",
  "requestId": "<unique request identifier>",
  "result": {
    "successes": ["<documentId>"],
    "errors": [
      { 
        "_id": "anotherDocumentId", 
        "reason": "cannot find document" 
      }
    ]
  }
}
```
