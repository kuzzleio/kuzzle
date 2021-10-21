---
code: true
type: page
title: refreshToken
---

# refreshToken

<SinceBadge version="1.7.0"/>

Refreshes an authentication token:

* a valid, non-expired authentication token must be provided
* the provided authentication token is revoked
* a new authentication token is generated and returned

::: warning
API Keys and token with infinite duration cannot be refreshed
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_refreshToken[?expiresIn=<expiresIn>]
Method: POST  
```

### Other protocols

```js
{
  "controller": "auth",
  "action": "refreshToken",
  "expiresIn": "<expiresIn>"
}
```

---

## Arguments

### Optional:

* `expiresIn`: set the expiration duration (default: depends on [Kuzzle configuration file](/core/2/guides/advanced/configuration))
* if a raw number is provided (not enclosed between quotes), then the expiration delay is in milliseconds. Example: `86400000`
* if this value is a string, then its content is parsed by the [ms](https://www.npmjs.com/package/ms) library. Examples: `"6d"`, `"10h"`

* `cookieAuth`: Enable the refresh of the token stored in the [HTTP Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
  - This only works in a Browser and only if Kuzzle CORS is properly configured. see [Authentication Token in the Browser](/core/2/guides/main-concepts/authentication)

---

## Response

The result contains the following properties:

* `_id`: user's [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid) 
* `jwt`: encrypted authentication token, [that must then be sent in the requests](/core/2/guides/main-concepts/authentication#authentication-token)
* `expiresAt`: new token expiration date, in Epoch-millis (UTC)
* `ttl`: new token time to live, in milliseconds

```javascript
{
  "status": 200,
  "error": null,
  "controller": "auth",
  "action": "refreshToken",
  "requestId": "<unique request identifier>",
  "volatile": {},
  "result": {
    "_id": "<kuid>",
    "jwt": "<JWT encrypted token>",
    "expiresAt": 1321085955000,
    "ttl": 360000
  }
}
```
