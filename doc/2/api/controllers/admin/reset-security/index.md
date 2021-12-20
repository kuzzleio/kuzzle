---
type: page

code: true
title: resetSecurity
---

# resetSecurity

Asynchronously deletes all users, profiles and roles.
Then resets `anonymous`, `default` and `admin` profiles and roles to default values, specified in Kuzzle configuration files.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/admin/_resetSecurity
Method: POST
```

### Other protocols

```js
{
  "controller": "admin",
  "action": "resetSecurity"
}
```

---

## Response

Returns a confirmation that the command is being executed.

```js
{
  "requestId": "d16d5e8c-464a-4589-938f-fd84f46080b9",
  "status": 200,
  "error": null,
  "controller": "admin",
  "action": "resetSecurity",
  "collection": null,
  "index": null,
  "result": { "deletedUsers": 5, "deletedProfiles": 2, "deletedRoles": 1 },
  "room": "4f9f6301-b2f8-4d13-b227-1598310f4750"
}
```
