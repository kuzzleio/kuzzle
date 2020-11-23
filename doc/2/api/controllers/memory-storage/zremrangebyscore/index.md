---
code: true
type: page
title: zremrangebyscore
---

# zremrangebyscore



Removes members from a sorted set, with a score between the provided interval.

[[_Redis documentation_]](https://redis.io/commands/zremrangebylex)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_zremrangebyscore/<_id>
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
  "action": "zremrangebyscore",
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

- `min`: minimum score value
- `max`: maximum score value

The `min` and `max` values are inclusive, but this behavior can be changed (see the [redis documentation](https://redis.io/commands/zrangebyscore)).

---

## Response

Returns the number of removed elements.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "zremrangebyscore",
  "collection": null,
  "index": null,
  "result": 16
}
```
