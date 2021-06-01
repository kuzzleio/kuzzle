---
code: true
type: page
title: deleteUser
---

# deleteUser

<DeprecatedBadge version="auto-version">

__Use [user:delete](/core/2/api/controllers/user/delete) instead.__

Deletes a user and all their associate credentials.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/users/<_id>[?refresh=wait_for]
Method: DELETE
```

### Other protocols

```js
{
  "controller": "security",
  "action": "deleteUser",
  "_id": "<kuid>"
}
```

---

## Arguments

- `_id`: user [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid) to delete

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the user deletion is indexed (default: `"wait_for"`)

---

## Response

Returns the deleted kuid.

```js
{
  "status": 200,
  "error": null,
  "result": {
    "_id": "<kuid>",
  }
  "action": "deleteUser",
  "controller": "security",
  "requestId": "<unique request identifier>"
}
```
