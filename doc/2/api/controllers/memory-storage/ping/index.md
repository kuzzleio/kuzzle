---
code: true
type: page
title: ping | API | Core
---

# ping



Pings the memory storage database.

[[_Redis documentation_]](https://redis.io/commands/ping)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_ping
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "ping"
}
```

---

## Response

Returns a `"PONG"` response.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "ping",
  "collection": null,
  "index": null,
  "result": "PONG"
}
```
