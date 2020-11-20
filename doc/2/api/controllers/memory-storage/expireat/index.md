---
code: true
type: page
title: expireat
---

# expireat



Sets an expiration timestamp on a key. After the timestamp has been reached, the key will automatically be deleted.

The `timestamp` parameter accepts an [Epoch time](https://en.wikipedia.org/wiki/Unix_time) value.

[[_Redis documentation_]](https://redis.io/commands/expireat)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_expireat/<_id>
Method: POST
Body:
```

```js
{
  "timestamp": 1538640821
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "expireat",
  "_id": "<key>",
  "body": {
    "timestamp": 1538640821
  }
}
```

---

## Arguments

- `_id`: key to update

---

## Body properties

- `timestamp`: timestamp of when the key expires, in Epoch format (integer)

---

## Response

Returns either `0` (command failed), or `1` (command succeeded).

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "expireat",
  "collection": null,
  "index": null,
  "result": 1
}
```
