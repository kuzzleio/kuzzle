---
code: true
type: page
title: bitpos | API | Core
---

# bitpos



Returns the position of the first bit set to 1 or 0 in a string, or in a substring.

[[_Redis documentation_]](https://redis.io/commands/bitpos)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_bitpos/<_id>?bit=[0|1][&start=<integer>&end=<integer>]
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "bitpos",
  "_id": "<key>",
  "bit": "[0|1]",
  "start": <integer>,
  "end": <integer>
}
```

---

## Arguments

- `_id`: key to examine
- `bit`: bit to look for. Accepted values: `0`, `1`

### Optional:

- `start`: search starts at the provided offset
- `end`: search ends at the provided offset

---

## Response

Returns the position of the first bit found matching the searched value.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "bitpos",
  "collection": null,
  "index": null,
  "result": 42
}
```
