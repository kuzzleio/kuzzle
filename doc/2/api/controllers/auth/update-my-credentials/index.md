---
code: true
type: page
title: updateMyCredentials
---

# updateMyCredentials



Updates the credentials of the currently logged in user.

---

## Query Syntax

### HTTP

<SinceBadge version="2.4.0"/>
```http
URL: http://kuzzle:7512/_me/credentials/<strategy>/_update
Method: PUT
Headers: Authorization: "Bearer <authentication token>"
Body:
```

<DeprecatedBadge version="2.4.0">
```http
URL: http://kuzzle:7512/credentials/<strategy>/_me/_update
Method: PUT
Headers: Authorization: "Bearer <authentication token>"
Body:
```
</DeprecatedBadge>

```js
{
  "password": "MyPassword"
}
```

### Other protocols

```js
{
  "controller": "auth",
  "action": "updateMyCredentials",
  "strategy": "<strategy>",
  "jwt": "<authentication token>",
  "body": {
    "password": "MyPassword"
  }
}
```

---

## Arguments

- `jwt`: valid authentication token (for the HTTP protocol, the token is to be passed to the `Authorization` header instead)
- `strategy`: name of the authentication strategy to update

---

## Body properties

The body contains the credential properties to update, and their new values.

The properties that can be updated depend on the chosen authentication strategy.

The API request examples in this page are for the [`local` authentication plugin](https://github.com/kuzzleio/kuzzle-plugin-auth-passport-local).

---

## Response

The result content depends on the authentication strategy.

Example with the "local" authentication strategy:

```js
{
  "status": 200,
  "error": null,
  "action": "updateMyCredentials",
  "controller": "auth",
  "result": {
    "username": "MyUser",
    "kuid": "<kuid>"
  }
}
```
