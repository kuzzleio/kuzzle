---
code: true
type: page
title: zcount
---

# zcount



Returns the number of elements held by a sorted set with a score within the provided `min` and `max` values.

[[_Redis documentation_]](https://redis.io/commands/zcount)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_zcount/<_id>?min=<min score>&max=<max score>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "zcount",
  "_id": "<key>",
  "min": "<min score>",
  "max": "<max score>"
}
```

---

## Arguments

- `_id`: sorted set identifier
- `min`: minimum score
- `max`: maximum score

By default, the provided min and max values are inclusive. This behavior can be changed using the syntax described in the Redis [ZRANGEBYSCORE](https://redis.io/commands/zrangebyscore) documentation.

---

## Response

Returns the number of elements within the specified range.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "zcount",
  "collection": null,
  "index": null,
  "result": 3
}
```
