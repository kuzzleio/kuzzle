---
code: true
type: page
title: credentialsExist | API | Core
---

# credentialsExist



Checks that the current authenticated user has credentials for the specified authentication strategy.

---

## Query Syntax

### HTTP

<SinceBadge version="2.4.0"/>
```http
URL: http://kuzzle:7512/_me/credentials/<strategy>/_exists
Method: GET
Headers: Authorization: "Bearer <authentication token>"
```

<DeprecatedBadge version="2.4.0">
```http
URL: http://kuzzle:7512/credentials/<strategy>/_me/_exists
Method: GET
Headers: Authorization: "Bearer <authentication token>"
```
</DeprecatedBadge>

### Other protocols

```js
{
  "controller": "auth",
  "action": "credentialsExist",
  "strategy": "<strategy>",
  "jwt": "<authentication token>"
}
```

---

## Arguments

- `jwt`: valid authentication token (for the HTTP protocol, the token is to be passed to the `Authorization` header instead)
- `strategy`: name of the authentication strategy to be tested

---

## Response

Result is a boolean telling whether credentials exist for the provided authentication strategy:

```js
{
  "status": 200,
  "error": null,
  "action": "credentialsExist",
  "controller": "auth",
  "result": true
}
```
