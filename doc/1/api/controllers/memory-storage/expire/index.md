---
code: true
type: page
title: expire
---

# expire



Sets a timeout (in seconds) on a key. After the timeout has expired, the key is automatically deleted.

[[_Redis documentation_]](https://redis.io/commands/expire)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_expire/<_id>
Method: POST
Body:
```

```js
{
  "seconds": 60
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "expire",
  "_id": "<key>",
  "body": {
    "seconds": 60
  }
}
```

---

## Arguments

- `_id`: key to update

---

## Body properties

- `seconds`: number of seconds before the key expires (integer)

---

## Response

Returns either `0` (command failed), or `1` (command succeeded).

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "expire",
  "collection": null,
  "index": null,
  "result": 1
}
```
