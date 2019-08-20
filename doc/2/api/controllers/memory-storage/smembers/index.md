---
code: true
type: page
title: smembers
---

# smembers



Returns the members of a set of unique values.

[[_Redis documentation_]](https://redis.io/commands/smembers)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_smembers/<_id>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "smembers",
  "_id": "<key>"
}
```

---

## Argument

- `_id`: set key identifier

---

## Response

Returns the list of the set's members.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "smembers",
  "collection": null,
  "index": null,
  "result": [
    "member1",
    "member2",
    "..."
  ]
}
```
