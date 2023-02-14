---
code: true
type: page
title: getStrategies | API | Core
---

# getStrategies



Gets the exhaustive list of registered authentication strategies.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/strategies
Method: GET
```

### Other protocols

```js
{
  "controller": "auth",
  "action": "getStrategies"
}
```

---

## Response

The result is an array of available strategy names:

```js
{
  "status": 200,
  "error": null,
  "action": "getStrategies",
  "controller": "auth",
  "result": [
    "local",
    "facebook"
  ]
}
```
