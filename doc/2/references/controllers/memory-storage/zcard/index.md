---
code: true
type: page
title: zcard
---

# zcard



Returns the number of elements held by a sorted set.

[[_Redis documentation_]](https://redis.io/commands/zcard)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_zcard/<_id>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "zcard",
  "_id": "<key>"
}
```

---

## Arguments

- `_id`: sorted set identifier

---

## Response

Returns the number of members in the sorted set.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "zcard",
  "collection": null,
  "index": null,
  "result": 10
}
```
