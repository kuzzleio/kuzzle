---
code: true
type: page
title: refreshToken
---

# refreshToken

<SinceBadge version="1.7.0"/>

Refreshes an authentication token:

* a valid, non-expired authentication must be provided
* the provided authentication token is revoked
* a new authentication token is generated and returned

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

* `expiresIn`: set the expiration duration (default: depends on [Kuzzle configuration file](/core/2/guides/essentials/configuration))
* if a raw number is provided (not enclosed between quotes), then the expiration delay is in milliseconds. Example: `86400000`
* if this value is a string, then its content is parsed by the [ms](https://www.npmjs.com/package/ms) library. Examples: `"6d"`, `"10h"`

---

## Response

The result contains the following properties:

* `_id`: user's [kuid](/core/2/guides/kuzzle-depth/authentication#the-kuzzle-user-identifier) 
* `jwt`: encrypted JSON Web Token, that must then be sent in the [requests headers](core/1/api/essentials/query-syntax#http) or in the [query](core/1/api/essentials/query-syntax#other-protocols)
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
