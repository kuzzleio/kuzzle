---
code: true
type: page
title: limits
---

# limits



Returns the kuzzle configuration limits.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_limits
Method: GET
```

### Other protocols

```js
{
  "controller": "server",
  "action": "limits"
}
```

---

## Response

Returns a `limits` property containing the configuration limits.

```js
{
  "status": 200,
  "error": null,
  "controller": "server",
  "action": "limits",
  "requestId": "<unique request identifier>",
  "result": {
    "limits": {
      "concurrentRequests": 100,
      "documentsFetchCount": 10000,
      "documentsWriteCount": 200,
      "loginsPerSecond": 1
    }
  }
}
```
