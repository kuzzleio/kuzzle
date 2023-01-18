---
code: true
type: page
title: sunion | API | Core
---

# sunion



Returns the union of sets of unique values.

[[_Redis documentation_]](https://redis.io/commands/sunion)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_sunion?keys=key1,key2,...
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "sunion",
  "keys": ["key1", "key2", "..."]
}
```

---

## Arguments

- `keys`: array of set identifiers

---

## Response

Returns the result of the union between the provided sets.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "sunion",
  "collection": null,
  "index": null,
  "result": [
    "value1",
    "value2",
    "..."
  ]
}
```
