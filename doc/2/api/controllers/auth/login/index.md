---
code: true
type: page
title: login
---

# login



Authenticates a user.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_login/<strategy>[?expiresIn=<expiresIn>]
Method: POST
Body:
```

```js
{
  "username": "<username>",
  "password": "<password>"
}
```

### Other protocols

```js
{
  "controller": "auth",
  "action": "login",
  "strategy": "<strategy>",
  "expiresIn": "<expiresIn>",
  "body": {
    "username": "<username>",
    "password": "<password>"
  }
}
```

---

## Arguments

- `strategy`: the name of the authentication [strategy](/core/2/guides/main-concepts/5-authentication) used to log the user in.

### Optional:

- `expiresIn`: set the expiration duration (default: depends on [Kuzzle configuration file](/core/2/guides/advanced/8-configuration))
  - if a raw number is provided (not enclosed between quotes), then the expiration delay is in milliseconds. Example: `86400000`
  - if this value is a string, then its content is parsed by the [ms](https://www.npmjs.com/package/ms) library. Examples: `"6d"`, `"10h"`

---

## Body properties

Depending on the chosen authentication strategy, additional [credential arguments](/core/2/guides/main-concepts/5-authentication#credentials) may be required.

The API request example in this page provides the necessary arguments for the [`local` authentication plugin](https://github.com/kuzzleio/kuzzle-plugin-auth-passport-local).

Check the appropriate [authentication plugin](/core/2/plugins/guides/strategies) documentation to get the list of additional arguments to provide.

---

## Response

The result contains the following properties:

- `_id`: user's [kuid](/core/2/guides/main-concepts/5-authentication#kuzzle-user-identifier)
- `jwt`: encrypted JSON Web Token, that must then be sent in the [requests headers](/core/2/guides/main-concepts/5-authentication#authentication-token) or in the [query](/core/2/guides/main-concepts/3-querying)
- `expiresAt`: token expiration date, in Epoch-millis (UTC)
- `ttl`: token time to live, in milliseconds

```js
{
  "status": 200,
  "error": null,
  "controller": "auth",
  "action": "login",
  "requestId": "<unique request identifier>",
  "volatile": {},
  "result": {
    "_id": "<kuid>",
    "jwt": "<JWT encrypted token>",
    "expiresAt": 1321085955000,
    "ttl": 360000
  }
}
```
