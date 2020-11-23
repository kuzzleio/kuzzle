---
code: true
type: page
title: smove
---

# smove



Moves a member from a set of unique values to another.

[[_Redis documentation_]](https://redis.io/commands/smove)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_smove/<_id>
Method: POST
Body:
```

```js
{
  "destination": "<destination key>",
  "member": "<member>"
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "smove",
  "_id": "<key>",
  "body": {
    "destination": "<destination key>",
    "member": "<member>"
  }
}
```

---

## Argument

- `_id`: source set identifier

---

## Body properties

- `destination`: destination set identifier
- `member`: member value to move

---

## Response

Returns either `0` (command failed), or `1` (command succeeded).

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "smove",
  "collection": null,
  "index": null,
  "result": 1
}
```
