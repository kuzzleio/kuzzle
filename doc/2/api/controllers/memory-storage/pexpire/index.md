---
code: true
type: page
title: pexpire | API | Core
---

# pexpire



Sets a timeout (in milliseconds) on a key. After the timeout has expired, the key will automatically be deleted.

[[_Redis documentation_]](https://redis.io/commands/pexpire)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_pexpire/<_id>
Method: POST
Body:
```

```js
{
  "milliseconds": 60000
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "pexpire",
  "_id": "<key>",
  "body": {
    "milliseconds": 60000
}
```

---

## Argument

- `_id`: key identifier

---

## Body properties

- `milliseconds`: the number of milliseconds after which the key is deleted

---

## Response

Returns either `0` (command failed), or `1` (command succeeded).

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "pexpire",
  "collection": null,
  "index": null,
  "result": 1
}
```
