---
code: true
type: page
title: decr | API | Core
---

# decr



Decrements the number stored at `key` by 1. If the key does not exist, it is set to 0 before performing the operation.

[[_Redis documentation_]](https://redis.io/commands/decr)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_decr/<_id>
Method: POST
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "decr",
  "_id": "<key>"
}
```

---

## Arguments

- `_id`: key to decrement

---

## Response

Returns the updated key value.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "decr",
  "collection": null,
  "index": null,
  "result": -13
}
```
