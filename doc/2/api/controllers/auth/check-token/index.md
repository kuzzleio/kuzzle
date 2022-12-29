---
code: true
type: page
title: checkToken | API | Core
---

# checkToken

Checks the validity of an authentication token.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_checkToken
Method: POST
Body:
```

```js
{
  "token": "<authentication token to check>"
}
```

### Other protocols

```js
{
  "controller": "auth",
  "action": "checkToken",
  "body": {
    "token": "<authentication token to check>"
  }
}
```

---

<SinceBadge version="2.16.8">
When no token is provided the method returns information about the anonymous token (`kuid` is `-1`), instead of throwing an error.

## Body properties

- `token`: the authentication token to be tested

---

### Optional:

- `cookieAuth`: Enable the validation of the token in an [HTTP Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
  - This only works in a Browser and only if Kuzzle CORS is properly configured. see [Authentication Token in the Browser](/core/2/guides/main-concepts/authentication)

---

## Response

The returned result contains the following properties:

- `expiresAt`: token expiration timestamp. Present only if `valid` is true
- `state`: the reason why a token is invalid. Present only if `valid` is false
- `kuid`: identifier of the user linked to this token <SinceBadge version="2.8.0" />
- `valid`: a boolean telling whether the provided token is valid or not

Example:

```js
{
  "status": 200,
  "error": null,
  "controller": "auth",
  "action": "checkToken",
  "requestId": "<unique request identifier>",
  "result": {
    "valid": true,
    "expiresAt": 1538557452248,
    "kuid": "5c6a775f-495c-472e-b29b-f6a4fa9f6a3e"
  }
}
```
