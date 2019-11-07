---
code: true
type: page
title: createToken
---

# createToken

Creates a new authentication token for a user. 

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/users/<_id>/tokens/_create[?refresh=wait_for][&expiresIn=-1]
Method: POST
Body:
```

```js
{
  "expiresIn": -1,
  "description": "Sigfox callback authentication token"
}
```

### Other protocols

```js
{
  "controller": "security",
  "action": "createToken",
  "body": {
    "description": "Sigfox callback authentication token"
  },

  // optional arguments
  "expiresIn": -1,
  "refresh": "wait_for"
}
```

---

## Arguments

- `_id`: user [kuid](/core/2/guides/kuzzle-depth/authentication#the-kuzzle-user-identifier)

### Optional:

- `expiresIn`: set the expiration duration (`-1` by default)
  - if a raw number is provided (not enclosed between quotes), then the expiration delay is in milliseconds. Example: `86400000`
  - if this value is a string, then its content is parsed by the [ms](https://www.npmjs.com/package/ms) library. Examples: `"6d"`, `"10h"`
  - if `-1` is provided, the token will never expire
- `refresh`: if set to `wait_for`, Kuzzle will not respond until the newly created user is indexed

---

## Body properties

- `description`: token description

---

## Response

Returns an object containing informations about the newly created token:

- `hash`: fingerprint (SHA512)
- `expiresAt`: expiration date in UNIX micro-timestamp format (`-1` if the token never expires)
- `ttl`: original ttl
- `description`: description

```js
{
  "status": 200,
  "error": null,
  "controller": "security",
  "action": "createToken",
  "requestId": "<unique request identifier>",
  "result": {
    "hash": "AD791031EEBBF517862F4D86B2D61F95535CF1F6A20AEF0E6141D1336AB4EA79",
    "expiresAt": -1,
    "ttl": -1,
    "description": "Sigfox callback authentication token"
  }
}
```
