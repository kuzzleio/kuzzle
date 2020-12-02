---
code: true
type: page
title: createApiKey
---

# createApiKey

Creates a new API key for a user. 

::: info
API keys are just authentication tokens.
You can use your API key the same way you use your authentication token by adding it to the `Authorization` header (with the value `Bearer <YourApiKeyHere>`)
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/users/<userId>/api-keys/_create[?refresh=wait_for][&expiresIn=-1][&_id=null]
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
  "controller": "security",
  "action": "createApiKey",
  "userId": "mWakSm4BWtbu6xy6NY8K",
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

- `userId`: user [kuid](/core/2/guides/main-concepts/5-authentication#kuzzle-user-identifier-kuid)
  
### Optional:

- `expiresIn`: set the expiration duration (`-1` by default)
  - if a raw number is provided (not enclosed between quotes), then the expiration delay is in milliseconds. Example: `86400000`
  - if this value is a string, then its content is parsed by the [ms](https://www.npmjs.com/package/ms) library. Examples: `"6d"`, `"10h"`
  - if `-1` is provided, the token will never expire
- `refresh`: if set to `wait_for`, Kuzzle will not respond until the newly created API key is indexed (default: `"wait_for"`)
- `_id`: sets the API key unique ID to the provided value, instead of auto-generating a random ID

---

## Body properties

- `description`: token description

---

## Response

Returns an object containing the newly created API key:

- `_id`: API key ID
- `_source`: API key content
  - `userId`: user kuid
  - `expiresAt`: expiration date in UNIX micro-timestamp format (`-1` if the token never expires)
  - `ttl`: original ttl
  - `description`: description
  - `fingerprint`: SHA256 hash of the authentication token
  - `token`: authentication token associated with this API key

::: warning
The authentication token `token` will never be returned by Kuzzle again. If you lose it, you'll have to delete the API key and recreate a new one.
:::

```js
{
  "status": 200,
  "error": null,
  "controller": "security",
  "action": "createApiKey",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "api-key-id",
    "_source": {
      "userId": "mWakSm4BWtbu6xy6NY8K",
      "expiresAt": -1,
      "ttl": -1,
      "description": "Sigfox callback authentication token",
      "fingerprint": "4ee98cb8c614e99213e7695f822e42325d86c93cfaf39cb40e860939e784c8e6",
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiJNeSIsImlhdCI6MTU3MzE4NTkzNSwiZXhwIjoxNTczMTg1OTM0fQ.08qAnSD03V0N1OcviGVUAZEjjv4DxULTgoQQwojn1PA"
    }
  }
}
```
