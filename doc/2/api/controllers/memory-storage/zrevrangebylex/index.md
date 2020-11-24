---
code: true
type: page
title: zrevrangebylex
---

# zrevrangebylex



Identical to [zrangebylex](/core/2/api/controllers/memory-storage/zrangebylex) except that the sorted set is traversed in descending order.

[[_Redis documentation_]](https://redis.io/commands/zrevrangebylex)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_zrevrangebylex/<_id>?min=<min interval>&max=<max interval>[&limit=offset,count]
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "zrevrangebylex",
  "_id": "<key>",
  "min": "<min interval>",
  "max": "<max interval>",

  "limit": ["<offset>", "<count>"]
}
```

---

## Arguments

- `_id`: sorted set identifier
- `min`: minimum element value
- `max`: maximum element value

The `min` and `max` values are inclusive by default. To change this behavior, check the full Redis documentation.

### Optional:

- `limit`: an array of 2 integers, used to limit the number of returned matching elements (similar to _SELECT LIMIT offset, count_ in SQL). Format: `[<offset>,<count>]`

---

## Response

Returns an array of matched elements.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "zrevrangebylex",
  "collection": null,
  "index": null,
  "result": [
    "...",
    "element2",
    "element1"
  ]
}
```
