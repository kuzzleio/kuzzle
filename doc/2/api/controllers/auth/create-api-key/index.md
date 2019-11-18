---
code: true
type: page
title: createApiKey
---

# createApiKey

Creates a new API key.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/api-keys/_create[?refresh=wait_for][&expiresIn=-1][&_id=null]
Method: POST
Body:
```

```js
{
  "description": "Sigfox callback authentication api key"
}
```

### Other protocols

```js
{
  "controller": "auth",
  "action": "createApiKey",
  "body": {
    "description": "Sigfox callback authentication api key"
  },

  // optional arguments
  "_id": "api-key-id",
  "expiresIn": -1,
  "refresh": "wait_for"
}
```

---

## Arguments
  
### Optional:

- `expiresIn`: set the expiration duration (`-1` by default)
  - if a raw number is provided (not enclosed between quotes), then the expiration delay is in milliseconds. Example: `86400000`
  - if this value is a string, then its content is parsed by the [ms](https://www.npmjs.com/package/ms) library. Examples: `"6d"`, `"10h"`
  - if `-1` is provided, the token will never expire
- `refresh`: if set to `wait_for`, Kuzzle will not respond until the newly created API key is indexed
- `_id`: set the API key unique ID to the provided value, instead of auto-generating a random ID

---

## Body properties

- `description`: token description

---

## Response

Returns an object containing the newly created API key:

- `_id`: API key ID
- `_source`: API key content
  - `userId`: user kuid
  - `hash`: fingerprint
  - `expiresAt`: expiration date in UNIX micro-timestamp format (`-1` if the token never expires)
  - `ttl`: original ttl
  - `description`: description
  - `token`: authentication token associated with this API key

::: warning
The authentication token `token` is displayed only once.
:::

```js
{
  "status": 200,
  "error": null,
  "controller": "auth",
  "action": "createApiKey",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "api-key-id",
    "_source": {
      "userId": "mWakSm4BWtbu6xy6NY8K",
      "hash": "AD791031EEBBF517862F4D86B2D61F95535CF1F6A20AEF0E6141D1336AB4EA79",
      "expiresAt": -1,
      "ttl": -1,
      "description": "Sigfox callback authentication token",
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiJNeSIsImlhdCI6MTU3MzE4NTkzNSwiZXhwIjoxNTczMTg1OTM0fQ.08qAnSD03V0N1OcviGVUAZEjjv4DxULTgoQQwojn1PA"
    }
  }
}
```
