---
code: true
type: page
title: get
---

# get



Gets the value of a key.

[[_Redis documentation_]](https://redis.io/commands/get)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/<_id>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "get",
  "_id": "<key>"
}
```

---

## Arguments

- `_id`: key to fetch

---

## Response

Returns the queried key's value. If the key doesn't exist, `get` returns `null`.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "get",
  "collection": null,
  "index": null,
  "result": "value"
}
```
