---
code: true
type: page
title: logout
---

# logout



Revokes the provided authentication token.

If there were any, real-time subscriptions are cancelled.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_logout
Method: POST
Headers: Authorization: "Bearer <authentication token>"
```

### Other protocols

```js
{
  "controller": "auth",
  "action": "logout",
  "jwt": "<authentication token>"
}
```

---

## Arguments

- `jwt`: valid authentication token (for the HTTP protocol, the token is to be passed to the `Authorization` header instead)

---

## Response

```js
{
  "status": 200,
  "error": null,
  "controller": "auth",
  "action": "logout",
  "requestId": "<unique request identifier>",
  "result": {}
}
```
