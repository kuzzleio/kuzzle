---
code: true
type: page
title: adminExists
---

# adminExists



Checks that an administrator account exists.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_adminExists
Method: GET
```

### Other protocols

```js
{
  "controller": "server",
  "action": "adminExists"
}
```

---

## Response

Returns an `exists` boolean telling whether an administrator account exists.

```js
{
  "status": 200,
  "error": null,
  "index": null,
  "collection": null,
  "action": "adminExists",
  "controller": "server",
  "requestId": "<unique request identifier>",
  "result": {
    "exists": true
  }
}
```
