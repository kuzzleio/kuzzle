---
code: true
type: page
title: hasCredentials
---

# hasCredentials



Checks if a user has credentials registered for the specified authentication strategy.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/credentials/<strategy>/<_id>/_exists
Method: GET
```

### Other protocols

```js
{
  "controller": "security",
  "action": "hasCredentials",
  "strategy": "<strategy>",
  "_id": "<kuid>"
}
```

---

## Arguments

- `_id`: user [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid)
- `strategy`: authentication strategy

---

## Response

Returns a boolean telling whether the user can log in using the provided authentication strategy.

```js
{
  "status": 200,
  "error": null,
  "action": "hasCredentials",
  "controller": "security",
  "_id": "<kuid>",
  "result": true
}
```
