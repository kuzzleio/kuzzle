---
code: true
type: page
title: zrange | API | Core
---

# zrange



Returns elements depending on their position in the sorted set.

[[_Redis documentation_]](https://redis.io/commands/zrange)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_zrange/<_id>?start=<index start>&stop=<index stop>[&options=withscores]
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "zrange",
  "_id": "<key>",
  "start": <index start>,
  "stop": <index stop>,
  // optional
  "options": ["withscores"]
}
```

---

## Arguments

- `_id`: sorted set identifier
- `start`: starting position index, inclusive
- `stop`: ending position index, inclusive

### Optional:

- `withscores`: return the score alongside the found elements

---

## Response

By default, returns the list of elements in the provided index range:

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "zrange",
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
  "action": "zrange",
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
