---
code: true
type: page
title: getbit | API | Core
---

# getbit



Returns the bit value at the provided offset, in the string value stored in a key.

[[_Redis documentation_]](https://redis.io/commands/getbit)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_getbit/<_id>?offset=<offset>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "getbit",
  "_id": "<key>",
  "offset": "<offset>"
}
```

---

## Arguments

- `_id`: key containing the geopoints to fetch
- `offset`: bit offset to return

---

## Response

Returns the bit at the provided offset. The returned value can be either `0` or `1`.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "getbit",
  "collection": null,
  "index": null,
  "result": 0
}
```
