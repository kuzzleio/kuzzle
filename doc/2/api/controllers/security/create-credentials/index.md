---
code: true
type: page
title: createCredentials
---

# createCredentials



Creates authentication credentials for a user.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/credentials/<strategy>/<_id>/_create
Method: POST
Body:
```

```js
{
  // example for the "local" authentication strategy
  "username": "MyUser",
  "password": "MyPassword"
}
```

### Other protocols

```js
{
  "controller": "security",
  "action": "createCredentials",
  "strategy": "<strategy>",
  "_id": "<kuid>",
  "body": {
    // example for the "local" authentication strategy
    "username": "MyUser",
    "password": "MyPassword"
  }
}
```

---

## Arguments

- `_id`: user unique [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid)
- `strategy`: name of the target authentication strategy for the credentials

---

## Body properties

The credentials to send. The expected properties depend on the target authentication strategy.

---

## Response

The result content depends on the authentication strategy.

Example with the `local` authentication strategy:

```js
{
  "status": 200,
  "error": null,
  "action": "createCredentials",
  "controller": "security",
  "_id": "<kuid>",
  "result": {
    "username": "MyUser",
    "kuid": "<kuid>"
  }
}
```
