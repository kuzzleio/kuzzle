---
code: true
type: page
title: createRole | API | Core
---

# createRole



Creates a new role.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/roles/<_id>/_create[?refresh=wait_for][&force]
Method: POST
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
  "action": "createRole",
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

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the created role is indexed (default: `"wait_for"`)

- `force`: if set to `true`, creates the role even if it gives access to non-existent plugins API actions.

---

## Body properties

- `controllers`: [role definition](/core/2/guides/main-concepts/permissions#roles)

---

## Response

Returns the role creation/replacement status:

- `_id`: created/replaced role identifier
- `_source`: role definition
- `created`: always true
- `version`: always 1

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
  "action": "createRole"
}
```
