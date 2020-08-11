---
code: true
type: page
title: getCurrentUser
---

# getCurrentUser



Returns information about the currently logged in user.

---

## Query Syntax

### HTTP

<SinceBadge version="2.4.0"/>
```http
URL: http://kuzzle:7512/_me
Method: GET
Headers: Authorization: "Bearer <authentication token>"
```

<DeprecatedBadge version="2.4.0">
```http
URL: http://kuzzle:7512/users/_me
Method: GET
Headers: Authorization: "Bearer <authentication token>"
```
</DeprecatedBadge>

### Other protocols

```js
{
  "controller": "auth",
  "action": "getCurrentUser",
  "jwt": "<authentication token>"
}
```

---

## Arguments

- `jwt`: valid authentication token (for the HTTP protocol, the token is to be passed to the `Authorization` header instead)

---

## Response

The result contains the following properties:

- `_id`: current user's [kuid](/core/2/guides/essentials/user-authentication#kuzzle-user-identifier-kuid)
- `_source`: user information
  - `profileIds`: list of [profile](/core/2/guides/essentials/security#users-profiles-and-roles) names associated to the user
  - any other properties: additional (and optional) user information
- `strategies`: available authentication strategies for that user

```js
{
  "status": 200,
  "error": null,
  "controller": "auth",
  "action": "getCurrentUser",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<kuid>",
    "_source": {
      "profileIds": ["customProfile1", "customProfile2"],
      "name": {
        "first": "Steve",
        "last": "Wozniak"
      }
    },
    "strategies": ["local"]
  }
}
```
