---
code: true
type: page
title: deleteRole
---

# deleteRole



Deletes a security role.

An error is returned if the role is still in use.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/roles/<_id>[?refresh=wait_for]
Method: DELETE
```

### Other protocols

```js
{
  "controller": "security",
  "action": "deleteRole",
  "_id": "<roleId>"
}
```

---

## Arguments

- `_id`: role identifier

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the role deletion is indexed (default: `"wait_for"`)

---

## Response

Returns the deleted role identifier.

```js
{
  "status": 200,
  "error": null,
  "result": {
    "_id": "<roleId>"
  }
  "action": "deleteRole",
  "controller": "security",
  "requestId": "<unique request identifier>"
}
```
