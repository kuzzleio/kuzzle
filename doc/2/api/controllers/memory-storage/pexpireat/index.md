---
code: true
type: page
title: pexpireat | API | Core
---

# pexpireat



Sets an expiration timestamp on a key. After the timestamp has been reached, the key will automatically be deleted.

The `timestamp` parameter accepts an [Epoch time](https://en.wikipedia.org/wiki/Unix_time) value, in milliseconds.

[[_Redis documentation_]](https://redis.io/commands/pexpireat)

---

## Argument

- `_id`: key identifier

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_pexpireat/<_id>
Method: POST
Body:
```

```js
{
  "timestamp": 1538640821799
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "pexpireat",
  "_id": "<key>",
  "body": {
    "timestamp": 1538640821799
  }
}
```

---

## Argument

- `_id`: key identifier

---

## Body properties

- `timestamp`: the key expiration timestamp, using the Epoch-millis format

---

## Response

Returns either `0` (command failed), or `1` (command succeeded).

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "pexpireat",
  "collection": null,
  "index": null,
  "result": 1
}
```
