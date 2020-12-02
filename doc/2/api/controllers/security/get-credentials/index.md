---
code: true
type: page
title: getCredentials
---

# getCredentials



Gets a user's credential information for the specified authentication strategy.

The returned content depends on the authentication strategy, but it should never include sensitive information.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/credentials/<strategy>/<_id>
Method: GET
```

### Other protocols

```js
{
  "controller": "security",
  "action": "getCredentials",
  "strategy": "<strategy>",
  "_id": "<kuid>"
}
```

---

## Arguments

- `_id`: user [kuid](/core/2/guides/main-concepts/5-authentication#kuzzle-user-identifier-kuid)
- `strategy`: authentication strategy name

---

## Response

Returns credentials information (depend on the authentication strategy).

### Example with the "local" authentication strategy:

```js

{
  "status": 200,
  "error": null,
  "action": "getCredentials",
  "controller": "security",
  "_id": "<kuid>",
  "result": {
    "username": "MyUser",
    "kuid": "<kuid>"
  }
}
```
