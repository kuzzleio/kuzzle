---
code: true
type: page
title: zrank | API | Core
---

# zrank



Returns the position of an element in a sorted set, with scores sorted in ascending order. The index returned is 0-based (the lowest score member has an index of 0).

[[_Redis documentation_]](https://redis.io/commands/zrank)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_zrank/<_id>/<member>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "zrank",
  "_id": "<key>",
  "member": "<member>"
}
```

---

## Arguments

- `_id`: sorted set identifier
- `member`: member value to search

---

## Response

Returns the index of the found member in the sorted set, or `null` if the member is not found.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "zrank",
  "collection": null,
  "index": null,
  "result": 12
}
```
