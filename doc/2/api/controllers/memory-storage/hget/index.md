---
code: true
type: page
title: hget | API | Core
---

# hget



Returns the field's value of a hash.

[[_Redis documentation_]](https://redis.io/commands/hget)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_hget/<_id>/<field>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "hget",
  "_id": "<key>",
  "field": "field name"
}
```

---

## Arguments

- `_id`: hash key identifier
- `field`: field name to retrieve

---

## Response

Returns the field's value.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "hget",
  "collection": null,
  "index": null,
  "result": "field value"
}
```
