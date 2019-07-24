---
code: true
type: page
title: object
---

# object



Inspects the low-level properties of a key.

[[_Redis documentation_]](https://redis.io/commands/object)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_object/<_id>?subcommand=[refcount|encoding|idletime]
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "object",
  "_id": "<key>",
  "subcommand": "[refcount|encoding|idletime]"
}
```

---

## Argument

- `_id`: key identifier
- `subcommand`: the object property to inspect. Allowed values: `refcount`, `encoding`, `idletime`

---

## Response

If `subcommand` is set to `refcount` or `idletime`, then an integer is returned:

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "object",
  "collection": null,
  "index": null,
  "result": 62993
}
```

If `subcommand` is set to `encoding`, then a string is returned:

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "object",
  "collection": null,
  "index": null,
  "result": "ziplist"
}
```
