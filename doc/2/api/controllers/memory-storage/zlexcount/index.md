---
code: true
type: page
title: zlexcount
---

# zlexcount



Counts elements in a sorted set where all members have equal score, using lexicographical ordering.

[[_Redis documentation_]](https://redis.io/commands/zlexcount)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_zlexcount/<_id>?min=<min value>&max=<max value>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "zlexcount",
  "_id": "<key>",
  "min": "<min value>",
  "max": "<max value>"
}
```

---

## Arguments

- `_id`: sorted set identifier
- `min`: range minimum value
- `max`: range maximum value

The `min` and `max` values are inclusive by default. To change this behavior, check the syntax detailed in the [Redis documentation](https://redis.io/commands/zrangebylex).

---

## Response

Returns the number of elements in the sorted set included in the provided range.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "zlexcount",
  "collection": null,
  "index": null,
  "result": 3
}
```
