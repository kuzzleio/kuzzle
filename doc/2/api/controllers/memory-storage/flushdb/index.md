---
code: true
type: page
title: flushdb | API | Core
---

# flushdb



Empties the database dedicated to client applications (the reserved space for Kuzzle is unaffected).

[[_Redis documentation_]](https://redis.io/commands/flushdb)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_flushdb
Method: POST
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "flushdb"
}
```

---

## Response

Returns `1`.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "flushdb",
  "collection": null,
  "index": null,
  "result": 1
}
```
