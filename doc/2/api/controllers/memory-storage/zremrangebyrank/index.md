---
code: true
type: page
title: zremrangebyrank
---

# zremrangebyrank



Removes members from a sorted set, with their position in the set within a provided index range.

Positions are 0-based, meaning the first member of the set has a position of 0.

[[_Redis documentation_]](https://redis.io/commands/zremrangebyrank)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_zremrangebyrank/<_id>
Method: DELETE
Body:
```

```js
{
  "start": "<index start>",
  "stop": "<index stop>"
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "zremrangebyrank",
  "_id": "<key>",
  "body": {
    "start": "<index start>",
    "stop": "<index stop>"
  }
}
```

---

## Arguments

- `_id`: sorted set identifier

---

## Body properties

- `start`: starting index position, inclusive
- `stop`: ending index position, inclusive

---

## Response

Returns the number of removed elements.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "zremrangebyrank",
  "collection": null,
  "index": null,
  "result": 3
}
```
