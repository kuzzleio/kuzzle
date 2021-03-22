---
code: true
type: page
title: revokeTokens
---

# revokeTokens

<SinceBadge version="auto-version"/>

Revokes every token of a given user.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/user/<_id>/tokens
Method: DELETE
```

### Other protocols

```js
{
  "controller": "user",
  "action": "revokeTokens",
  "_id": "<kuid>"
}
```

---

## Arguments

- `_id`: user [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid)

---

## Response

```js
{
  "status": 200,
  "error": null,
  "result": null,
  "action": "revokeTokens",
  "controller": "user",
  "requestId": "<unique request identifier>"
}
```
