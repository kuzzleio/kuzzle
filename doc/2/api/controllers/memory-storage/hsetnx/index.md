---
code: true
type: page
title: hsetnx | API | Core
---

# hsetnx



Sets a field and its value in a hash, only if the field does not already exist.

[[_Redis documentation_]](https://redis.io/commands/hsetnx)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_hsetnx/<_id>
Method: POST
Body:
```

```js
{
  "field": "<field name>",
  "value": "<field value>"
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "hsetnx",
  "_id": "<key>",
  "body": {
    "field": "<field name>",
    "value": "<field value>"
  }
}
```

---

## Arguments

- `_id`: hash key identifier

---

## Body properties

- `field`: new hash field name
- `value`: hash field value

---

## Response

Returns either `0` (command failed), or `1` (command succeeded).

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "hsetnx",
  "collection": null,
  "index": null,
  "result": 1
}
```
