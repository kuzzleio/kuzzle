---
code: true
type: page
title: deleteApiKey | API | Core
---

# deleteApiKey

Deletes an API key of the currently logged in user.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/api-keys/<apiKeyId>[?refresh=wait_for]
Method: DELETE
```

Over HTTP, the API key can only be targeted by its `_id`. To delete it by `key` or `fingerprint`, use another protocol.

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

One of the following must be provided to identify the API key to delete. If several are given, `_id` is used first, then `key`, then `fingerprint`, and the others are ignored:

- `_id`: API key ID
- `key`: the clear-text API key (not available over HTTP) <SinceBadge version="2.57.0"/>
- `fingerprint`: the API key fingerprint (SHA-256 hash of the clear-text key; not available over HTTP) <SinceBadge version="2.57.0"/>

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
    "_id": "api-key-id"
  },
  "action": "deleteApiKey",
  "controller": "auth",
  "requestId": "<unique request identifier>"
}
```

---

## Possible errors

- [Common errors](/core/2/api/errors/types#common-errors)
- [NotFoundError](/core/2/api/errors/types#notfounderror): no API key of the current user matches the given `_id`, `key` or `fingerprint`
