---
code: true
type: page
title: deleteCredentials | API | Core
---

# deleteCredentials



Deletes user credentials for the specified authentication strategy.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/credentials/<strategy>/<_id>
Method: DELETE
```

### Other protocols

```js
{
  "controller": "security",
  "action": "deleteCredentials",
  "strategy": "<strategy>",
  "_id": "<kuid>"
}
```

---

## Arguments

- `_id`: user [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid)
- `strategy`: authentication strategy name to remove

---

## Response

Returns an acknowledgement.

```js
{
  "status": 200,
  "error": null,
  "action": "deleteCredentials",
  "controller": "security",
  "_id": "<kuid>",
  "result": {
    "acknowledged": true
  }
}
```
