---
code: true
type: page
title: ttl
---

# ttl



Returns the remaining time to live of a key, in seconds.

[[_Redis documentation_]](https://redis.io/commands/ttl)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_ttl/<_id>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "ttl",
  "_id": "<key>"
}
```

---

## Arguments

- `_id`: key identifier

---

## Response

Returns the remaining key TTL, in seconds, or a negative value if the key does not exist or if it is persistent.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "ttl",
  "collection": null,
  "index": null,
  "result": 76
}
```
