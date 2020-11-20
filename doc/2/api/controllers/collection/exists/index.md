---
code: true
type: page
title: exists
---

# exists



Checks whether a collection exists.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/<collection>/_exists
Method: GET
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "collection",
  "action": "exists"
}
```

---

## Arguments

- `collection`: collection name
- `index`: index name

---

## Response

Returns a boolean telling whether the provided collection exists:

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "collection": "<collection>",
  "controller": "collection",
  "action": "exists",
  "requestId": "<unique request identifier>",
  "result": true
}
```

---

## Possible errors

- [Common errors](/core/2/api/essentials/error-handling#common-errors)

