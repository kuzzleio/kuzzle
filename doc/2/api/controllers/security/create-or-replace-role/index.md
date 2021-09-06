---
code: true
type: page
title: createOrReplaceRole
---

# createOrReplaceRole



Creates a new role or, if the provided role identifier already exists, replaces it.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/roles/<_id>[?refresh=wait_for]
Method: PUT
Body:
```

```js
{
  "tags": ["moderators"],
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
  "action": "createOrReplaceRole",
  "_id": "<roleId>",
  "body": {
    "tags": ["moderators"],
    "controllers": {
      "*": {
        "actions": {
          "*": true
        }
      }
    }
  }
}
```

---

## Arguments

- `_id`: role identifier

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the created/replaced role is indexed (default: `"wait_for"`)

- `force`: if set to `true`, creates or replaces the role even if it gives access to non-existent plugins API actions.

---

## Body properties

- `controllers`: [role definition](/core/2/guides/main-concepts/permissions#roles)

---

## Response

Returns the role creation/replacement status:

- `_id`: created/replaced role identifier
- `_source`: role definition
- `created`: if true, the role has been created. Otherwise, it has been replaced
- `version`: updated role version number

```js
{
  "status": 200,
  "error": null,
  "result": {
    "_id": "<roleId>",
    "_version": 1,
    "created": true,
    "_source": {
      "controllers": {
        "*": {
          "actions": {
            "*": true
          }
        }
      }
    }
  }
  "requestId": "<unique request identifier>",
  "controller": "security",
  "action": "createOrReplaceRole"
}
```
