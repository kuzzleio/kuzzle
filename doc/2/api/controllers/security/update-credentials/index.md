---
code: true
type: page
title: updateCredentials
---

# updateCredentials



Updates a user credentials for the specified authentication strategy.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/credentials/<strategy>/<_id>/_update
Method: PUT
Body:
```

```js
{
  // example with the "local" authentication strategy
  "password": "<new password>"
}
```

### Other protocols

```js
{
  "controller": "security",
  "action": "updateCredentials",
  "strategy": "<strategy>",
  "_id": "<kuid>",
  "body": {
    // example with the "local" authentication strategy
    "password": "<new password>"
  }
}
```

---

## Arguments

- `_id`: user [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid)
- `strategy`: authentication strategy

---

## Body properties

The properties that can be sent to update a user credentials depend entirely of the authentication strategy.

---

## Response

Returns the authentication strategy response.

### Example for the "local" authentication strategy:

```js
{
  "status": 200,
  "error": null,
  "action": "updateCredentials",
  "controller": "security",
  "_id": "<kuid>",
  "result": {
    "username": "MyUser",
    "kuid": "<kuid>"
  }
}
```
