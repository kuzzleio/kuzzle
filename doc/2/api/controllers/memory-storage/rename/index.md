---
code: true
type: page
title: rename
---

# rename



Renames a key.

If the new key name is already used, then it is overwritten.

[[_Redis documentation_]](https://redis.io/commands/rename)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_rename/<_id>
Method: POST
Body:
```

```js
{
  "newkey": "<new key name>"
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "rename",
  "_id": "<key>",
  "body": {
    "newkey": "<new key name>"
  }
}
```

---

## Argument

- `_id`: key to rename

---

## Body properties

- `newkey`: the new key name

---

## Response

Returns an acknowledgement.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "rename",
  "collection": null,
  "index": null,
  "result": "OK"
}
```
