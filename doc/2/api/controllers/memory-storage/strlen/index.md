---
code: true
type: page
title: strlen | API | Core
---

# strlen



Returns the length of a value.

[[_Redis documentation_]](https://redis.io/commands/strlen)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_strlen/<_id>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "strlen",
  "_id": "<key>"
}
```

---

## Arguments

- `_id`: key identifier holding a string value

---

## Response

Returns a string length.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "strlen",
  "collection": null,
  "index": null,
  "result": 6
}
```
