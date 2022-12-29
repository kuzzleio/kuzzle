---
code: true
type: page
title: incr | API | Core
---

# incr



Increments the number stored at `key` by 1. If the key does not exist, it is set to 0 before performing the operation.

[[_Redis documentation_]](https://redis.io/commands/incr)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_incr/<_id>
Method: POST
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "incr",
  "_id": "<key>"
}
```

---

## Arguments

- `_id`: key identifier

---

## Response

Returns the incremented key value.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "incr",
  "collection": null,
  "index": null,
  "result": 6
}
```
