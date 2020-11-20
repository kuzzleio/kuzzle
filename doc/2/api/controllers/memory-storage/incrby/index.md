---
code: true
type: page
title: incrby
---

# incrby



Increments the number stored at `key` by the provided integer value. If the key does not exist, it is set to 0 before performing the operation.

[[_Redis documentation_]](https://redis.io/commands/incrby)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_incrby/<_id>
Method: POST
Body:
```

```js
{
  "value": <increment integer value>
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "incrby",
  "_id": "<key>",
  "body": {
    "value": <increment integer value>
  }
}
```

---

## Arguments

- `_id`: key identifier

---

## Body properties

- `value`: the integer value to add to the key value

---

## Response

Returns the incremented key value.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "incrby",
  "collection": null,
  "index": null,
  "result": 7
}
```
