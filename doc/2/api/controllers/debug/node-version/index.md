---
code: true
type: page
title: nodeVersion
---

# nodeVersion

Return the current node version Kuzzle is running on.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/debug/_nodeVersion
Method: GET
```

### Other protocols

```js
{
  "controller": "debug",
  "action": "nodeVersion",
}
```

## Response

Returns a string representing the node version:

```js
{
  "status": 200,
  "error": null,
  "controller": "debug",
  "action": "nodeVersion",
  "requestId": "<unique request identifier>",
  "result": "<node version>"
}
```
