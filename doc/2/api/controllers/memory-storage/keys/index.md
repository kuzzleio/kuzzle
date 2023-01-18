---
code: true
type: page
title: keys | API | Core
---

# keys



Returns all keys matching the provided pattern.

[[_Redis documentation_]](https://redis.io/commands/keys)

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/ms/_keys/<pattern>
Method: GET
```

### Other protocols

```js
{
  "controller": "ms",
  "action": "keys",
  "pattern": "foo*"
}
```

---

## Arguments

- `pattern`: match pattern

---

## Response

Returns the list of matching keys.

```js
{
  "requestId": "<unique request identifier>",
  "status": 200,
  "error": null,
  "controller": "ms",
  "action": "keys",
  "collection": null,
  "index": null,
  "result": [
    "fookey1",
    "fookey2",
    "foo..."
  ]
}
```
