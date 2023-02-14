---
code: true
type: page
title: hkeys | API | Core
---

# hkeys



Returns all field names contained in a hash.

[[_Redis documentation_]](https://redis.io/commands/hkeys)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_hkeys/<_id>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "hkeys",
  "_id": "<key>"
}
```

---

## Arguments

- `_id`: hash key identifier

---

## Response

Returns an array of hash field names.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "hkeys",
  "collection": null,
  "index": null,
  "result": [
    "field1",
    "field2",
    "..."
  ]
}
```
