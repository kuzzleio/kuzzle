---
code: true
type: page
title: truncate
---

# truncate

Empties a collection by removing all its documents, while keeping any associated mapping.

::: info
Documents removed that way do not trigger real-time notifications.
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_truncate
Method: DELETE
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "collection",
  "action": "truncate"
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

---

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

- [Common errors](/core/2/api/essentials/error-handling#common-errors)
- [NotFoundError](/core/2/api/essentials/error-handling#notfounderror)

