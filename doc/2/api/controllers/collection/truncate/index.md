---
code: true
type: page
title: truncate
---

# truncate

Empties a collection by removing all its documents, while keeping any associated mapping.

::: warning
Documents removed that way do not trigger real-time notifications.
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_truncate[?strategy=<documents|collection>]
Method: DELETE
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "collection",
  "action": "truncate",

  // optional
  "strategy": "<documents|collection>"
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name
- `strategy`: truncate strategy <SinceBadge version="auto-version" />

---

### strategy

<SinceBadge version="auto-version" />

Two strategies are available when truncating a collection:
  - `collection`: delete and re-create the underlaying collection
  - `documents`: search and deletes every documents in the collection

Both methods offer similar performances when truncating a collection with < 10 million documents.    
However when truncating many collection, it's faster to use the `documents` strategy because the storage engine is able to perform those actions simultaneously.

## Response

Returns a confirmation that the collection is being emptied:

```js
{
  "status": 200,
  "error": null,
  "action": "truncate",
  "controller": "collection",
  "index": "<index>",
  "collection": "<collection>",
  "requestId": "<unique request identifier>",
  "result": {
    "acknowledged": true,
  }
}
```

---

## Possible errors

- [Common errors](/core/2/api/errors/types#common-errors)
- [NotFoundError](/core/2/api/errors/types#notfounderror)

