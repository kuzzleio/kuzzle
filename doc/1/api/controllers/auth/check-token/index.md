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
  "token": "<the JWT to check>"
}
```

### Other protocols

```js
{
  "controller": "auth",
  "action": "checkToken",
  "body": {
    "token": "<the JWT to check>"
  }
}
```

---

## Body properties

- `token`: the authentication token to be tested

---

## Response

The returned result contains the following properties:

- `valid`: a boolean telling whether the provided token is valid
- `state`: the reason why a token is invalid. Present only if `valid` is false
- `expiresAt`: token expiration timestamp. Present only if `valid` is true

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
    "expiresAt": 1538557452248
  }
}
```
