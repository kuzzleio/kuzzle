---
code: true
type: page
title: lset
---

# lset



Sets the list element at `index` with the provided value.

[[_Redis documentation_]](https://redis.io/commands/lset)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_lset/<_id>
Method: POST
Body:
```

```js
{
  "index": 0,
  "value": "<value>"
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "lset",
  "_id": "<key>",
  "body": {
    "index": 0,
    "value": "<value>"
  }
}
```

---

## Argument

- `_id`: list key identifier

---

## Body properties

- `index`: index of the list. Lists are 0-indexed. If negative, it goes backward from the end of the list
- `value`: the new value to set

---

## Response

Returns an acknowledgement.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "lset",
  "collection": null,
  "index": null,
  "result": "OK"
}
```
