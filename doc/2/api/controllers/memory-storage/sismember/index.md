---
code: true
type: page
title: sismember | API | Core
---

# sismember



Checks if a value is a member of a set of unique values.

[[_Redis documentation_]](https://redis.io/commands/sismember)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_sismember/<_id>/<member>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "sismember",
  "_id": "<key>",
  "member": "<member>"
}
```

---

## Argument

- `_id`: set key identifier
- `member`: member value to check

---

## Response

Returns either `1` (member belongs to the set), or `0`.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "sismember",
  "collection": null,
  "index": null,
  "result": 1
}
```
