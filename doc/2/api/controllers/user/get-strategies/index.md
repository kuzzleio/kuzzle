---
code: true
type: page
title: getStrategies
---

# getStrategies



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
  "controller": "user",
  "action": "getStrategies",
  "_id": "<kuid>"
}
```

---

## Arguments

- `_id`: user [kuid](/core/2/guides/kuzzle-depth/authentication#the-kuzzle-user-identifier)

---

## Response

Returns an object with a `strategies` array containing all the available authentication strategies on the requested user.

```js
{
  "status": 200,
  "error": null,
  "result": {
    "strategies": ["local"],
  }
}
```
