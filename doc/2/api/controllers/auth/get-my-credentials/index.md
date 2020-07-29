---
code: true
type: page
title: getMyCredentials
---

# getMyCredentials



Returns credential information for the currently logged in user.

The data returned will depend on the specified authentication strategy, and they should not include any sensitive information.

The result can be an empty object.

---

## Query Syntax

### HTTP

<SinceBadge version="auto-version"/>
```http
URL: http://kuzzle:7512/_me/credentials/<strategy>
Method: GET
Headers: Authorization: "Bearer <authentication token>"
```

<DeprecatedBadge version="auto-version">
```http
URL: http://kuzzle:7512/credentials/<strategy>/_me
Method: GET
Headers: Authorization: "Bearer <authentication token>"
```
</DeprecatedBadge>

### Other protocols

```js
{
  "controller": "auth",
  "action": "getMyCredentials",
  "strategy": "<strategy>",
  "jwt": "<authentication token>"
}
```

---

## Arguments

- `jwt`: valid authentication token (for the HTTP protocol, the token is to be passed to the `Authorization` header instead)
- `strategy`: name of the authentication strategy to retrieve

---

## Response

The result content depends on the authentication strategy.

Example with the `local` authentication strategy:

```js
{
  "status": 200,
  "error": null,
  "action": "getMyCredentials",
  "controller": "auth",
  "result": {
    "username": "MyUser",
    "kuid": "<kuid>"
  }
}
```
