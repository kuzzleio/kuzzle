---
code: true
type: page
title: deleteApiKey
---

# deleteApiKey

Deletes a user API key.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/users/<userId>/api-keys/<apiKeyId>[?refresh=wait_for]
Method: DELETE
```

### Other protocols

```js
{
  "controller": "security",
  "action": "deleteApiKey",
  "userId": "mWakSm4BWtbu6xy6NY8K",
  "_id": "api-key-id"
}
```

---

## Arguments

- `_id`: API key ID
- `userId`: user [kuid](/core/2/guides/kuzzle-depth/authentication#the-kuzzle-user-identifier)

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the API key deletion is indexed (default: `"wait_for"`)

---

## Response

Returns the deleted API key ID.

```js
{
  "status": 200,
  "error": null,
  "result": {
    "_id": "api-key-id",
  }
  "action": "deleteApiKey",
  "controller": "security",
  "requestId": "<unique request identifier>"
}
```
