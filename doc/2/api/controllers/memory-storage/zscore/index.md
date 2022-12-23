---
code: true
type: page
title: zscore | API | Core
---

# zscore



Returns the score of an element in a sorted set.

[[_Redis documentation_]](https://redis.io/commands/zscore)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_zscore/<_id>/<member>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "zscore",
  "_id": "<key>",
  "member": "<member>"
}
```

---

## Arguments

- `_id`: sorted set identifier
- `member`: member value to examine

---

## Response

Returns the member score.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "zscore",
  "collection": null,
  "index": null,
  "result": 23
}
```
