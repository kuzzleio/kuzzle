---
code: true
type: page
title: getUserStrategies
---

# getUserStrategies

<DeprecatedBadge version="auto-version">

__Use [user:getStrategies](/core/2/api/controllers/user/get-strategies) instead.__

Gets the available authentication strategies of a user.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/users/<_id>/_strategies
Method: GET
```

### Other protocols

```js
{
  "controller": "security",
  "action": "getUserStrategies",
  "_id": "<kuid>"
}
```

---

## Arguments

- `_id`: user [kuid](/core/2/guides/kuzzle-depth/authentication#the-kuzzle-user-identifier)

---

## Response

Returns an object with the following properties:

- `strategies`: array containing all the available authentication strategies on the requested user.
- `total`: total number of strategies found for that user.

```js
{
  "status": 200,
  "error": null,
  "result": {
    "strategies": ["local"],
    "total": 1
  }
}
```
