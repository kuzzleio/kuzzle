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
URL: http://kuzzle:7512/_logout[?global]
Method: POST
Headers: Authorization: "Bearer <authentication token>"
```

### Other protocols

```js
{
  "controller": "auth",
  "action": "logout",
  "jwt": "<authentication token>",
  "global": "<true|false>"
}
```

---

## Arguments

- `jwt`: valid authentication token (for the HTTP protocol, the token is to be passed to the `Authorization` header instead)

### Optional:

* `global`: if `true`, also revokes all other active sessions instead of just the current one (default: `false`)

* `cookieAuth`: Erase of the token in the [HTTP Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
  - This only works in a Browser and only if Kuzzle CORS is properly configured. see [Authentication Token in the Browser](/core/2/guides/main-concepts/authentication)


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
