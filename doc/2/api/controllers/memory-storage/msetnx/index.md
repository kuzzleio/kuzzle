---
code: true
type: page
title: msetnx
---

# msetnx



Sets the provided keys to their respective values, only if they do not exist. If a key exists, then the whole operation is aborted and no key is set.

[[_Redis documentation_]](https://redis.io/commands/msetnx)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_msetnx
Method: POST
Body:
```

```js
{
  "entries": [
    {"key": "<key1>", "value": "<value1>"},
    {"key": "<key2>", "value": "<value2>"},
    {"key": "...", "value": "..."}
  ]
}
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "msetnx",
  "body": {
    "entries": [
      {"key": "<key1>", "value": "<value1>"},
      {"key": "<key2>", "value": "<value2>"},
      {"key": "...", "value": "..."}
    ]
  }
}
```

---

## Body properties

- `entries`: an array of objects. Each object describes a new key-value pair to set, using the following properties:
  - `key`: key identifier
  - `value`: new value

---

## Response

Returns either `0` (command failed), or `1` (command succeeded).

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "msetnx",
  "collection": null,
  "index": null,
  "result": 1
}
```
