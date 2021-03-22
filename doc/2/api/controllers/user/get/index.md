---
code: true
type: page
title: get
---

# get

<SinceBadge version="auto-version"/>

Gets a user.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/user/<_id>
Method: GET
```

### Other protocols

```js
{
  "controller": "user",
  "action": "get",
  "_id": "<kuid>"
}
```

---

## Arguments

- `_id`: user [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid)

---

## Response

Returns the user information:

- `_id`: user kuid
- `_source`: user description

```js
{
  "status": 200,
  "error": null,
  "controller": "user",
  "action": "get",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<kuid>",
    "_source": {
      "profileIds": ["<profileId>"]
    }
  }
}
```
