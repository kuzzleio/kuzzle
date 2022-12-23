---
code: true
type: page
title: mDeleteRoles | API | Core
---

# mDeleteRoles



Deletes multiple security roles.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/roles/_mDelete[?refresh=wait_for]
Method: POST
Body:
```

```js
{
  "ids": ["role1", "role2", "..."]
}
```

### Other protocols

```js
{
  "controller": "security",
  "action": "mDeleteRoles",
  "body": {
    "ids": ["role1", "role2", "..."]
  }
}
```

---

## Arguments

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the deletions are indexed (default: `"wait_for"`)

---

## Body properties

- `ids`: an array of role identifiers to delete

---

## Response

Returns an array of successfully deleted roles.

```js
{
  "status": 200,
  "error": null,
  "action": "mDeleteRoles",
  "controller": "security",
  "requestId": "<unique request identifier>",
  "result": [
    "role1",
    "role2",
    "..."
  ]
}
```
