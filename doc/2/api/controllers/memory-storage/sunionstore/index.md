---
code: true
type: page
title: sunionstore | API | Core
---

# sunionstore



Computes the union of multiple sets of unique values and stores it in a new set.

If the destination key already exists, it is overwritten.

[[_Redis documentation_]](https://redis.io/commands/sunionstore)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_sunionstore
Method: POST
Body:
```

```js
{
  "destination": "<destination key>",
  "keys": ["key1", "key2", "..."]
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "sunionstore",
  "body": {
    "destination": "<destination key>",
    "keys": ["key1", "key2", "..."]
  }
}
```

---

## Body properties

- `destination`: destination for the union result
- `keys`: array of set identifiers

---

## Response

Returns the number of members stored in the destination set.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "sunionstore",
  "collection": null,
  "index": null,
  "result": 31
}
```
