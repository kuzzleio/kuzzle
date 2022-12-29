---
code: true
type: page
title: llen | API | Core
---

# llen



Returns the length of a list.

[[_Redis documentation_]](https://redis.io/commands/llen)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_llen/<_id>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "llen",
  "_id": "<key>"
}
```

---

## Argument

- `_id`: list key identifier

---

## Response

Returns the length of the list.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "llen",
  "collection": null,
  "index": null,
  "result": 7
}
```
