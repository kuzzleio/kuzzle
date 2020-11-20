---
code: true
type: page
title: touch
---

# touch



Alters the last access time of multiple keys. A key is ignored if it does not exist.

[[_Redis documentation_]](https://redis.io/commands/touch)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_touch
Method: POST
Body:
```

```js
{
  "keys": ["key1", "key2", "..."]
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "touch",
  "body": {
    "keys": ["key1", "key2", "..."]
  }
}
```

---

## Arguments

- `keys`: array of key identifiers to alter

---

## Response

Returns the number of altered keys.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "touch",
  "collection": null,
  "index": null,
  "result": 3
}
```
