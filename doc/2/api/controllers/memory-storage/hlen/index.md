---
code: true
type: page
title: hlen | API | Core
---

# hlen



Returns the number of fields contained in a hash.

[[_Redis documentation_]](https://redis.io/commands/hlen)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_hlen/<_id>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "hlen",
  "_id": "<key>"
}
```

---

## Arguments

- `_id`: hash key identifier

---

## Response

Returns the number of fields stored in a hash.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "hlen",
  "collection": null,
  "index": null,
  "result": 4
}
```
