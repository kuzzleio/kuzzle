---
code: true
type: page
title: mget
---

# mget



Returns the values of the provided keys.

[[_Redis documentation_]](https://redis.io/commands/mget)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_mget?keys=key1,key2,...
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "mget",
  "keys": ["key1", "key2", "..."]
}
```

---

## Argument

- `keys`: a list of keys to get

---

## Response

Returns the list of corresponding key values, in the same order than the one provided in the query.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "mget",
  "collection": null,
  "index": null,
  "result": [
    "value of key1",
    "value of key2",
    "..."
  ]
}
```
