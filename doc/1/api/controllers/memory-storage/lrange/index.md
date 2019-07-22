---
code: true
type: page
title: lrange
---

# lrange



Returns the list elements between the `start` and `stop` positions.

Offsets start at `0`, and the range is inclusive.

[[_Redis documentation_]](https://redis.io/commands/lrange)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_lrange/<_id>?start=<start>&stop=<stop>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "lrange",
  "_id": "<key>",
  "start": 0,
  "stop": -3
}
```

---

## Argument

- `_id`: list key identifier
- `start`: starting index
- `stop`: ending index

The arguments `start` and `stop` can be negative. In that case, the offset is calculated from the end of the list, going backward. For instance, `-3` is the third element from the end of the list.

---

## Response

Returns an array of list elements.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "lrange",
  "collection": null,
  "index": null,
  "result": [
    "value1",
    "value2",
    "..."
  ]
}
```
