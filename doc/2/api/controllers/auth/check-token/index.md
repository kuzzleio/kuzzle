---
code: true
type: page
title: checkToken
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

## Body properties

- `token`: the authentication token to be tested

---

## Response

The returned result contains the following properties:

- `expiresAt`: token expiration timestamp. Present only if `valid` is true
- `state`: the reason why a token is invalid. Present only if `valid` is false
- `kuid`: identifier of the user linked to this token <SinceBadge version="change-me" />
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
