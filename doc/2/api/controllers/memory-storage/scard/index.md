---
code: true
type: page
title: scard | API | Core
---

# scard



Returns the number of members stored in a set of unique values.

[[_Redis documentation_]](https://redis.io/commands/scard)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_scard/<_id>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "scard",
  "_id": "<key>"
}
```

---

## Argument

- `_id`: set key identifier

---

## Response

Returns the set length.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "scard",
  "collection": null,
  "index": null,
  "result": 36
}
```
