---
code: true
type: page
title: mset
---

# mset



Sets the provided keys to their respective values. If a key does not exist, it is created. Otherwise, the key's value is overwritten.

[[_Redis documentation_]](https://redis.io/commands/mset)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_mset
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
  "action": "mset",
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

Returns an acknowledgement.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "mset",
  "collection": null,
  "index": null,
  "result": "OK"
}
```
