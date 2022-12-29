---
code: true
type: page
title: del | API | Core
---

# del



Deletes a list of keys.

[[_Redis documentation_]](https://redis.io/commands/del)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms
Method: DELETE
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
  "action": "del",
  "body": {
    "keys": ["key1", "key2", "..."]
  }
}
```

---

## Body properties

- `keys`: an array of keys to delete

---

## Response

Returns the number of deleted keys.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "del",
  "collection": null,
  "index": null,
  "result": 3
}
```
