---
code: true
type: page
title: getUserStrategies
---

# getUserStrategies



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

Returns a `hits` array containing all the available authentication strategies for that user

```js
{
  "status": 200,
  "error": null,
  "result": {
    "hits": ["local"]
  }
}
```
