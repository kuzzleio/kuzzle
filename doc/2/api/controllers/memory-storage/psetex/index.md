---
code: true
type: page
title: psetex
---

# psetex



Sets a key with the provided value, and an expiration delay expressed in milliseconds. If the key does not exist, it is created beforehand.

[[_Redis documentation_]](https://redis.io/commands/psetex)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_psetex/<_id>
Method: POST
Body:
```

```js
{
  "milliseconds": 60000,
  "value": "<value>"
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "psetex",
  "_id": "<key>",
  "body": {
    "milliseconds": 60000,
    "value": "<value>"
  }
}
```

---

## Argument

- `_id`: key identifier

---

## Body properties

- `milliseconds`: the key time to live, in milliseconds
- `value`: new value

---

## Response

Returns an acknowledgement.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "psetex",
  "collection": null,
  "index": null,
  "result": "OK"
}
```
