---
code: true
type: page
title: exists
---

# exists



Checks if the specified keys exist in the database.

[[_Redis documentation_]](https://redis.io/commands/exists)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_exists?keys=key1,key2,...
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "exists",
  "keys": ["key1", "key2", "..."]
}
```

---

## Arguments

- `keys`: list of keys to verify

---

## Response

Returns the number of existing keys.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "exists",
  "collection": null,
  "index": null,
  "result": 1
}
```
