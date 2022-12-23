---
code: true
type: page
title: zremrangebylex | API | Core
---

# zremrangebylex



Removes members within a provided range, from a sorted set where all elements have the same score, using lexicographical ordering.

[[_Redis documentation_]](https://redis.io/commands/zremrangebylex)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_zremrangebylex/<_id>
Method: DELETE
Body:
```

```js
{
  "min": "<min interval>",
  "max": "<max interval>"
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "zremrangebylex",
  "_id": "<key>",
  "body": {
    "min": "<min interval>",
    "max": "<max interval>"
  }
}
```

---

## Arguments

- `_id`: sorted set identifier

---

## Body properties

- `min`: minimum range value
- `max`: maximum range value

The `min` and `max` interval are inclusive. See the [Redis documentation](https://redis.io/commands/zrangebylex) to change this behavior.

---

## Response

Returns the number of removed members.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "zremrangebylex",
  "collection": null,
  "index": null,
  "result": 14
}
```
