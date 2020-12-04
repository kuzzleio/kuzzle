---
code: true
type: page
title: revokeTokens
---

# revokeTokens



Revokes every token of a given user.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/users/<_id>/tokens
Method: DELETE
```

### Other protocols

```js
{
  "controller": "security",
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
  "controller": "security",
  "requestId": "<unique request identifier>"
}
```
