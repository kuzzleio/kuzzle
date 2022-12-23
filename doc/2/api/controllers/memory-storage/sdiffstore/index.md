---
code: true
type: page
title: sdiffstore | API | Core
---

# sdiffstore



Computes the difference between a reference set of unique values, and other sets. The differences are then stored in the provided destination key.

If the destination key already exists, it is overwritten.

[[_Redis documentation_]](https://redis.io/commands/sdiffstore)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_sdiffstore/<_id>
Method: POST
Body:
```

```js
{
  "destination": "<key>",
  "keys": ["key1", "key2", "..."]
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "sdiffstore",
  "_id": "<key>",
  "body": {
    "destination": "<key>",
    "keys": ["key1", "key2", "..."]
  }
}
```

---

## Argument

- `_id`: reference set identifier

---

## Body properties

- `destination`: the new set to create
- `keys`: source sets to diff with the reference set

---

## Response

Returns the number of elements stored in the resulting set.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "sdiffstore",
  "collection": null,
  "index": null,
  "result": 4
}
```
