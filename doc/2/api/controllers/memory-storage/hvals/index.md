---
code: true
type: page
title: hvals | API | Core
---

# hvals



Returns all values contained in a hash.

[[_Redis documentation_]](https://redis.io/commands/hvals)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_hvals/<_id>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "hvals",
  "_id": "<key>"
}
```

---

## Arguments

- `_id`: hash key identifier

---

## Response

Returns a list of hash values.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "hvals",
  "collection": null,
  "index": null,
  "result": [
    "<value of field1>",
    "<value of field2>",
    "..."
  ]
}
```
