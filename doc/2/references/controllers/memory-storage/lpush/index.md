---
code: true
type: page
title: lpush
---

# lpush



Prepends the specified values to a list.

If the key does not exist, it is created holding an empty list before performing the operation.

[[_Redis documentation_]](https://redis.io/commands/lpush)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_lpush/<_id>
Method: POST
Body:
```

```js
{
  "values": ["value1", "value2", "..."]
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "lpush",
  "_id": "<key>",
  "body": {
    "values": ["value1", "value2", "..."]
  }
}
```

---

## Argument

- `_id`: list key identifier

---

## Body properties

- `values`: array of values to push to the list

---

## Response

Returns the updated length of the list.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "lpush",
  "collection": null,
  "index": null,
  "result": 4
}
```
