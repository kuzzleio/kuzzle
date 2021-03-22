---
code: true
type: page
title: delete
---

# delete

<SinceBadge version="auto-version"/>

Deletes a user and all their associate credentials.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/user/<_id>[?refresh=wait_for]
Method: DELETE
```

### Other protocols

```js
{
  "controller": "user",
  "action": "delete",
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
  "action": "delete",
  "controller": "user",
  "requestId": "<unique request identifier>"
}
```
