---
code: true
type: page
title: zrangebyscore
---

# zrangebyscore



Returns all sorted set elements with a score within a provided range.

The elements are considered to be ordered from low to high scores.

[[_Redis documentation_]](https://redis.io/commands/zrangebyscore)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_zrangebyscore/<_id>?min=<min interval>&max=<max interval>[&limit=offset,count][&options=withscores]
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "zrangebyscore",
  "_id": "<key>",
  "min": "<min interval>",
  "max": "<max interval>",
  // optional
  "limit": ["<offset>", "<count>"],
  "options": ["withscores"]
}
```

---

## Arguments:

- `_id`: sorted set identifier
- `min`: minimum score
- `max`: maximum score

By default, `min` and `max` are inclusive. Check the full Redis documentation for other options.

### Optional:

- `limit`: an array of 2 integers, used to limit the number of returned matching elements (similar to _SELECT LIMIT offset, count_ in SQL). Format: `[<offset>,<count>]`
- `withscores`: return the score alongside the found elements

---

## Response

By default, returns the list of elements in the provided score range:

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "zrangebyscore",
  "collection": null,
  "index": null,
  "result": [
    "element1",
    "element2",
    "..."
  ]
}
```

If the `withscores` option is provided, then the returned array alternates elements with their score:

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "zrangebyscore",
  "collection": null,
  "index": null,
  "result": [
    "element1",
    "score of element1",
    "element2",
    "score of element2",
    "..."
  ]
}
```
