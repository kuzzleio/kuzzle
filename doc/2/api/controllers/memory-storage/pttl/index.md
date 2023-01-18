---
code: true
type: page
title: pttl | API | Core
---

# pttl



Returns the remaining time to live of a key, in milliseconds.

[[_Redis documentation_]](https://redis.io/commands/pttl)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_pttl/<_id>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "pttl",
  "_id": "<key>"
}
```

---

## Argument

- `_id`: key identifier

---

## Response

Returns the remaining TTL, in milliseconds.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "pttl",
  "collection": null,
  "index": null,
  "result": 43728
}
```
