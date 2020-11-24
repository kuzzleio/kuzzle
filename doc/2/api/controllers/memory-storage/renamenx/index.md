---
code: true
type: page
title: renamenx
---

# renamenx



Renames a key, only if the new name is not already used.

[[_Redis documentation_]](https://redis.io/commands/renamenx)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_renamenx/<_id>
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
  "action": "renamenx",
  "_id": "<key>",
  "body": {
    "newkey": "<new key name>"
  }
}
```

---

## Argument

- `_id`: key identifier

---

## Body properties

- `newkey`: the new key name

---

## Response

Returns either `0` (command failed), or `1` (command succeeded).

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "renamenx",
  "collection": null,
  "index": null,
  "result": 1
}
```
