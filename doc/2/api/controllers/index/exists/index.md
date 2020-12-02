---
code: true
type: page
title: exists
---

# exists



Checks if the given index exists in Kuzzle.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/<index>/_exists
Method: GET
```

### Other protocols

```js
{
  "index": "<index>",
  "controller": "index",
  "action": "exists"
}
```

---

## Arguments

- `index`: index name to test for existence

---

## Response

Returns a boolean telling whether the requested index exists.

```js
{
  "status": 200,
  "error": null,
  "index": "<index>",
  "controller": "index",
  "action": "exists",
  "requestId": "<unique request identifier>",
  "result": true
}
```

---

## Possible errors

- [Common errors](/core/2/api/errors/types#common-errors)

