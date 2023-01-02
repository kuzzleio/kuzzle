---
code: true
type: page
title: logout | API | Core
---

# logout



Revokes the provided authentication token if it's not an API key.
If you are trying to delete an API key, see [auth:deleteApiKey](/core/2/api/controllers/auth/delete-api-key).

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

* `global`: if `true`, also revokes all other active sessions that aren't using an API key, instead of just the current one (default: `false`)

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
