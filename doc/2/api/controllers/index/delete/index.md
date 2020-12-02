---
code: true
type: page
title: delete
---

# delete



Deletes an [index](/core/2/guides/main-concepts/2-data-storage).

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>
Method: DELETE
```

### Other protocols

```js
{
  "index": "<index>",
  "controller": "index",
  "action": "delete"
}
```

---

## Arguments

- `index`: index name to delete

---

## Response

Returns a confirmation that the index is being deleted:

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "controller": "index",
  "action": "delete",
  "requestId": "<unique request identifier>",
  "result": {
    "acknowledged": true
  }
}
```

---

## Possible errors

- [Common errors](/core/2/api/errors/types#common-errors)
- [NotFoundError](/core/2/api/errors/types#notfounderror)

