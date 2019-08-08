---
code: true
type: page
title: dbsize
---

# dbsize



Returns the number of keys in the application database.

[[_Redis documentation_]](https://redis.io/commands/dbsize)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_dbsize
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "dbsize",
}
```

---

## Response

Returns the number of found keys.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "dbsize",
  "collection": null,
  "index": null,
  "result": 42
}
```
