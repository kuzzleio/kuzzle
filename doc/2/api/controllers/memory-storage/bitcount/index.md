---
code: true
type: page
title: bitcount | API | Core
---

# bitcount



Counts the number of set bits (population counting) in a string.

[[_Redis documentation_]](https://redis.io/commands/bitcount)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_bitcount/<_id>[?start=<integer>&end=<integer>]
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "bitcount",
  "_id": "<key>"
  "start": <integer>,
  "end": <integer>
}
```

---

## Arguments

- `_id`: key to evaluate

### Optional:

- `start`: count starts at the provided offset
- `end`: count ends at the provided offset

---

## Response

Returns the number of set bits.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "bitcount",
  "collection": null,
  "index": null,
  "result": 42
}
```
