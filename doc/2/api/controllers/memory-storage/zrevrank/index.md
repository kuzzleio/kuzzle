---
code: true
type: page
title: zrevrank
---

# zrevrank



Returns the position of an element in a sorted set, with scores in descending order. The index returned is 0-based (the lowest score member has an index of 0).

[[_Redis documentation_]](https://redis.io/commands/zrevrank)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_zrevrank/<_id>/<member>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "zrevrank",
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
  "action": "zrevrank",
  "collection": null,
  "index": null,
  "result": 2
}
```
