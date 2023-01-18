---
code: true
type: page
title: hset | API | Core
---

# hset



Sets a field and its value in a hash.

If the key does not exist, a new key holding a hash is created.

If the field already exists, its value is overwritten.

[[_Redis documentation_]](https://redis.io/commands/hset)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_hset/<_id>
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
  "action": "hset",
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

- `field`: hash field name to set
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
  "action": "hset",
  "collection": null,
  "index": null,
  "result": 1
}
```
