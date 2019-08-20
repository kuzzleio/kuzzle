---
code: true
type: page
title: setnx
---

# setnx



Sets a value on a key, only if it does not already exist.

[[_Redis documentation_]](https://redis.io/commands/setnx)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_setnx/<_id>
Method: POST
Body:
```

```js
{
  "value": "<value>"
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "setnx",
  "_id": "<key>",
  "body": {
    "value": "<value>"
  }
}
```

---

## Argument

- `_id`: key identifier

---

## Body properties

- `value`: new key value

---

## Response

Returns either `0` (command failed), or `1` (command succeeded).

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "setnx",
  "collection": null,
  "index": null,
  "result": 1
}
```
