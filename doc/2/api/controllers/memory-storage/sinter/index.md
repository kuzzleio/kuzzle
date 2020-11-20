---
code: true
type: page
title: sinter
---

# sinter



Returns the intersection of the provided sets of unique values.

[[_Redis documentation_]](https://redis.io/commands/sinter)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_sinter?keys=key1,key2,...
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "sinter",
  "keys": ["key1", "key2", "..."]
}
```

---

## Argument

- `keys`: list of set identifiers to intersect

---

## Response

Returns an array of intersected values.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "sinter",
  "collection": null,
  "index": null,
  "result": [
    "value1",
    "value2",
    "..."
  ]
}
```
