---
code: true
type: page
title: deleteMyCredentials
---

# deleteMyCredentials



Deletes credentials associated to the current user.

If the credentials that generated the current JWT are removed, the user will remain logged in until they log out or their session expire. After that, they will no longer be able to log in with the deleted credentials.

---

## Query Syntax

### HTTP

<SinceBadge version="2.4.0"/>
```http
URL: http://kuzzle:7512/_me/credentials/<strategy>
Method: DELETE
Headers: Authorization: "Bearer <authentication token>"
```

<DeprecatedBadge version="2.4.0">
```http
URL: http://kuzzle:7512/credentials/<strategy>/_me
Method: DELETE
Headers: Authorization: "Bearer <authentication token>"
```
</DeprecatedBadge>

### Other protocols

```js
{
  "controller": "auth",
  "action": "deleteMyCredentials",
  "strategy": "<strategy>",
  "jwt": "<authentication token>"
}
```

---

## Arguments

- `jwt`: valid authentication token (for the HTTP protocol, the token is to be passed to the `Authorization` header instead)
- `strategy`: name of the authentication strategy to delete

---

## Response

Returns a confirmation that the credentials are being deleted:

```js
{
  "status": 200,
  "error": null,
  "action": "deleteMyCredentials",
  "controller": "auth",
  "result": {
    "acknowledged": true
  }
}
```
