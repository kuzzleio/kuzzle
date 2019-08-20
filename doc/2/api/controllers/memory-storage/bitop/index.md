---
code: true
type: page
title: bitop
---

# bitop



Performs a bitwise operation between multiple keys (containing string values) and stores the result in the destination key.

[[_Redis documentation_]](https://redis.io/commands/bitop)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_bitop/<_id>
Method: POST
Body:
```

```js
{
  "operation": "[AND|OR|XOR|NOT]",
  "keys": ["srckey1", "srckey2", "..."]
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "bitop",
  "_id": "destination key",
  "body": {
    "operation": "[AND|OR|XOR|NOT]",
    "keys": ["srckey1", "srckey2", "..."]
  }
}
```

---

## Arguments

- `_id`: destination key to create

---

## Body properties

- `keys`: the list of keys to combine
- `operation`: the bitwise operand to use to combine keys. Allowed values: `AND`, `NOT`, `OR`, `XOR`

---

## Response

Returns the new destination key length, as an integer.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "bitop",
  "collection": null,
  "index": null,
  "result": 42
}
```
