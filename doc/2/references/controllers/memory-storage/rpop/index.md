---
code: true
type: page
title: rpop
---

# rpop



Removes the last element of a list and returns it.

[[_Redis documentation_]](https://redis.io/commands/rpop)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_rpop/<_id>
Method: POST
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "rpop",
  "_id": "<key>"
}
```

---

## Argument

- `_id`: list key identifier

---

## Response

Returns the removed element.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "rpop",
  "collection": null,
  "index": null,
  "result": "bar"
}
```
