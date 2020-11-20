---
code: true
type: page
title: srandmember
---

# srandmember



Returns one or more members of a set of unique values, at random.

[[_Redis documentation_]](https://redis.io/commands/srandmember)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_srandmember/<_id>[?count=<count>]
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "srandmember",
  "_id": "<key>",
  // optional
  "count": "<count>"
}
```

---

## Arguments

- `_id`: set key identifier

### Optional:

- `count`: return `count` members, at random (default: `1`). If positive, then returned values are unique. If negative, a set member can be returned multiple times.

---

## Response

If `count` is not set or equal to `1`, returns the member as a string:

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "srandmember",
  "collection": null,
  "index": null,
  "result": "<random member>"
}
```

If the absolute count value is greater than `1`, then an array of random members is returned instead:

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "srandmember",
  "collection": null,
  "index": null,
  "result": [
    "random member 1",
    "random member 2",
    "..."
  ]
}
```
