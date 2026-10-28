---
code: true
type: page
title: deleteApiKey | API | Core
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

<SinceBadge version="2.57.0"/>

The API key can also be targeted by its clear-text `key` or its `fingerprint`
instead of its `_id`, using query string parameters:

```http
URL: http://kuzzle:7512/users/<userId>/api-keys[?key=<key>&refresh=wait_for]
Method: DELETE
```

```http
URL: http://kuzzle:7512/users/<userId>/api-keys[?fingerprint=<fingerprint>&refresh=wait_for]
Method: DELETE
```

::: warning
A `key` passed in the query string is a secret written in the URL, so it can end up in proxy and access logs. Prefer the `fingerprint`, or another protocol.
:::

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

- `userId`: user [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid)

One of the following must be provided to identify the API key to delete. If several are given, `_id` is used first, then `key`, then `fingerprint`, and the others are ignored:

- `_id`: API key ID
- `key`: the clear-text API key <SinceBadge version="2.57.0"/>
- `fingerprint`: the API key fingerprint (SHA-256 hash of the clear-text key) <SinceBadge version="2.57.0"/>

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
    "_id": "api-key-id"
  },
  "action": "deleteApiKey",
  "controller": "security",
  "requestId": "<unique request identifier>"
}
```

---

## Possible errors

- [Common errors](/core/2/api/errors/types#common-errors)
- [NotFoundError](/core/2/api/errors/types#notfounderror): no API key matches the given `_id`, `key` or `fingerprint` for this user
