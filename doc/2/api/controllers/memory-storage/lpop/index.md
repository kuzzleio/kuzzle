---
code: true
type: page
title: lpop | API | Core
---

# lpop



Removes and returns the first element of a list.

[[_Redis documentation_]](https://redis.io/commands/lpop)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_lpop/<_id>
Method: POST
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "lpop",
  "_id": "<key>"
}
```

---

## Argument

- `_id`: list key identifier

---

## Response

Returns the removed value.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "lpop",
  "collection": null,
  "index": null,
  "result": "foo"
}
```
