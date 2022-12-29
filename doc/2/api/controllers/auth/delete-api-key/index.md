---
code: true
type: page
title: deleteApiKey | API | Core
---

# deleteApiKey

Deletes an API key.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/api-keys/<apiKeyId>[?refresh=wait_for]
Method: DELETE
```

### Other protocols

```js
{
  "controller": "auth",
  "action": "deleteApiKey",
  "_id": "api-key-id"
}
```

---

## Arguments

- `_id`: API key ID

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the API key deletion is indexed

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
  "controller": "auth",
  "requestId": "<unique request identifier>"
}
```
