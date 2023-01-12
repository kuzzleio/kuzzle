---
code: true
type: page
title: createToken | API | Core
---

# createToken

Creates a token for the currently loggued user.

::: info
It is not possible to create token that does not expire to prevent memory leaks.
For this you should use [auth:createApiKey](/core/2/api/controllers/auth/create-api-key) instead.
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_createToken[&expiresIn=900][&unique]
Method: POST
Body:
```

```js
{
}
```

### Other protocols

```js
{
  "controller": "auth",
  "action": "createToken",


  // optional arguments
  "unique": true,
  "expiresIn": 900
}
```

---

## Arguments

### Optional

- `expiresIn`: set the expiration duration (`-1` by default)
  - if a raw number is provided (not enclosed between quotes), then the expiration delay is in milliseconds. Example: `86400000`
  - if this value is a string, then its content is parsed by the [ms](https://www.npmjs.com/package/ms) library. Examples: `"6d"`, `"10h"`
- `unique`: if set to `true`, then the token can be used only once

---

## Body properties

---

## Response

Returns an object containing the token:

- `expiresAt`: expiration date in UNIX micro-timestamp format
- `ttl`: original ttl
- `token`: authentication token associated with this API key
- `unique`: single use token

```js
{
  "status": 200,
  "error": null,
  "controller": "auth",
  "action": "createToken",
  "requestId": "<unique request identifier>",
  "result": {
    "expiresAt": -1,
    "ttl": -1,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiJNeSIsImlhdCI6MTU3MzE4NTkzNSwiZXhwIjoxNTczMTg1OTM0fQ.08qAnSD03V0N1OcviGVUAZEjjv4DxULTgoQQwojn1PA",
    "unique": true,
  }
}
```
