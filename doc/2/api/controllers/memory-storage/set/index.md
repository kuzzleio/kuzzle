---
code: true
type: page
title: set | API | Core
---

# set



Creates a key holding the provided value, or overwrites it if it already exists.

[[_Redis documentation_]](https://redis.io/commands/set)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_set/<_id>
Method: POST
Body:
```

```js
{
  "value": "<value>",
  "ex": 60,
  "nx": true
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "set",
  "_id": "<key>",
  "body": {
    "value": "<value>",
    "ex": 60,
    "nx": true
  }
}
```

---

## Argument

- `_id`: key identifier

---

## Body properties

### Optional:

- `ex`: set the specified expire time, in seconds
- `px`: set the specified expire time, in milliseconds
- `nx`: if true, only set the key if it does not already exist
- `xx`: if true, only set the key if it already exists

**Note:** `ex` and `px` options are mutually exclusive, and setting values to both lead to a `BadRequestError` error. Same thing goes for `nx` and `xx`.

---

## Response

Returns an acknowledgement.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "set",
  "collection": null,
  "index": null,
  "result": "OK"
}
```
