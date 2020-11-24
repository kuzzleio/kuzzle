---
code: true
type: page
title: updateRole
---

# updateRole

Updates a security role definition.

**Note:** partial updates are not supported for roles, this API action will replace the entire role content with the provided one.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/roles/<_id>/_update[?refresh=wait_for][&force][&retryOnConflict=10]
Method: PUT
Body:
```

```js
{
  "controllers": {
    "*": {
      "actions": {
        "*": true
      }
    }
  }
}
```

### Other protocols

```js
{
  "controller": "security",
  "action": "updateRole",
  "_id": "<roleId>",
  "body": {
    "controllers": {
      "*": {
        "actions": {
          "*": true
        }
      }
    }
  },
  // Optional
  "force": false,
  "refresh": "wait_for",
  "retryOnConflict": 10
}
```

---

## Arguments

- `_id`: role identifier

### Optional arguments

- `force`: if set to `true`, updates the role even if it gives access to non-existent plugins API actions (default: `false`)
- `refresh`: if set to `wait_for`, Kuzzle will not respond until the user changes are indexed (default: `"wait_for"`)
- `retryOnConflict`: in case of an update conflict in Elasticsearch, the number of retries before aborting the operation (default: `10`)

---

## Body properties

- `controllers`: [role definition](/core/2/guides/essentials/security#defining-roles)

---

## Response

Returns the updated role identifier and version number.

```js
{
  "status": 200,
  "error": null,
  "action": "updateRole",
  "controller": "security",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<roleId>",
    "_version": 2
  }
}
```
