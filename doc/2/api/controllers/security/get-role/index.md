---
code: true
type: page
title: getRole | API | Core
---

# getRole



Gets a security role.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/roles/<_id>
Method: GET
```

### Other protocols

```js
{
  "controller": "security",
  "action": "getRole",
  "_id": "<roleId>"
}
```

---

## Arguments

- `_id`: role identifier

---

## Response

Returns the queried role:

- `_id`: role identifier
- `_source`: role description

```js
{
  "status": 200,
  "error": null,
  "result": {
    "_id": "<roleId>",
    "_source": {
      "controllers": {
        "*": {
          "actions": true
        }
      }
    }
  },
  "action": "getRole",
  "controller": "security",
  "requestId": "<unique request identifier>"
}
```
