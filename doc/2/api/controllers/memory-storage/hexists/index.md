---
code: true
type: page
title: hexists
---

# hexists



Checks if a field exists in a hash.

[[_Redis documentation_]](https://redis.io/commands/hexists)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_hexists/<_id>/<field>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "hexists",
  "_id": "<key>",
  "field": "field name"
}
```

---

## Arguments

- `_id`: hash key identifier
- `field`: field name to check

---

## Response

Returns either `0` (the field does not exist), or `1` (the field exist).

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "hexists",
  "collection": null,
  "index": null,
  "result": [0|1]
}
```
