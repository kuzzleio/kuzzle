---
code: true
type: page
title: now
---

# now



Returns the current server timestamp, in Epoch-millis format.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_now
Method: GET
```

### Other protocols

```js
{
  "controller": "server",
  "action": "now"
}
```

---

## Response

Returns a `now` property containing the server timestamp, in Epoch-millis format.

```js
{
  "status": 200,
  "error": null,
  "controller": "server",
  "action": "now",
  "requestId": "<unique request identifier>",
  "result": {
    "now": 1447151167622
  }
}
```
