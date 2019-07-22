---
code: true
type: page
title: getrange
---

# getrange



Returns a substring of a key's value.

[[_Redis documentation_]](https://redis.io/commands/getrange)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_getrange/<_id>?start=<start>&end=<end>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "getrange",
  "_id": "<key>",
  "start": 1,
  "end": -3
}
```

---

## Arguments

- `_id`: key identifier
- `start`: substring starting position.
- `end`: substring ending position

The arguments `start` and `end` can be negative. In that case, the offset is calculated from the end of the string, going backward. For instance, `-3` is the third character from the end of the string.

---

## Response

Returns the calculated substring.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "getrange",
  "collection": null,
  "index": null,
  "result": "<value substring>"
}
```
