---
code: true
type: page
title: createMyCredentials | API | Core
---

# createMyCredentials



Creates new credentials for the current user.

---

## Query Syntax

### HTTP

<SinceBadge version="2.4.0"/>
```http
URL: http://kuzzle:7512/_me/credentials/<strategy>/_create
Method: POST
Headers: Authorization: "Bearer <authentication token>"
Body:
```

<DeprecatedBadge version="2.4.0">
```http
URL: http://kuzzle:7512/credentials/<strategy>/_me/_create
Method: POST
Headers: Authorization: "Bearer <authentication token>"
Body:
```
</DeprecatedBadge>

```js
{
  // example with the "local" authentication strategy
  "username": "MyUser",
  "password": "MyPassword"
}
```

### Other protocols

```js
{
  "controller": "auth",
  "action": "createMyCredentials",
  "strategy": "<strategy>",
  "jwt": "<authentication token>",
  "body": {
    "username": "MyUser",
    "password": "MyPassword"
  }
}
```

---

## Arguments

- `jwt`: valid authentication token (for the HTTP protocol, the token is to be passed to the `Authorization` header instead)
- `strategy`: name of the authentication strategy to use

---

## Body properties

Credentials to be created. The properties to send will depend on the chosen authentication strategy.

---

## Response

The result content depends on the authentication strategy.

Example with the `local` authentication strategy:

```js
{
  "status": 200,
  "error": null,
  "action": "createMyCredentials",
  "controller": "auth",
  "result": {
    "username": "MyUser",
    "kuid": "<kuid>"
  }
}
```
