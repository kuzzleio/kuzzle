---
code: true
type: page
title: zrevrangebyscore | API | Core
---

# zrevrangebyscore



Identical to [zrangebyscore](/core/2/api/controllers/memory-storage/zrangebyscore), except that the sorted set is traversed in descending order.

[[_Redis documentation_]](https://redis.io/commands/zrevrangebyscore)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_zrevrangebyscore/<_id>?min=<min interval>&max=<max interval>[&limit=offset,count][&options=withscores]
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "zrevrangebyscore",
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
  "action": "zrevrangebyscore",
  "collection": null,
  "index": null,
  "result": [
    "...",
    "element2",
    "element1"
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
  "action": "zrevrangebyscore",
  "collection": null,
  "index": null,
  "result": [
    "...",
    "element2",
    "score of element2",
    "element1",
    "score of element1"
  ]
}
```
