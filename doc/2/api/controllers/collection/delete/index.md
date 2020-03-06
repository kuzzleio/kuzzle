---
code: true
type: page
title: delete
---

# delete

Deletes a [collection](/core/2/guides/essentials/store-access-data).

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>
Method: DELETE
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "collection",
  "action": "delete"
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

---

## Response

Returns a confirmation that the collection is deleted:

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "collection",
  "action": "delete",
  "requestId": "<unique request identifier>",
  "result": null
}
```

---

## Possible errors

- [Common errors](/core/2/api/essentials/error-handling#common-errors)
- [PreconditionError](/core/2/api/essentials/error-handling#preconditionerror)
