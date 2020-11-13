---
code: true
type: page
title: getUser
---

# getUser



Gets a user.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/users/<_id>
Method: GET
```

### Other protocols

```js
{
  "controller": "security",
  "action": "getUser",
  "_id": "<kuid>"
}
```

---

## Arguments

- `_id`: user [kuid](/core/2/guides/kuzzle-depth/authentication#the-kuzzle-user-identifier)

---

## Response

Returns the user information:

- `_id`: user kuid
- `_source`: user description

```js
{
  "status": 200,
  "error": null,
  "controller": "security",
  "action": "getUser",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<kuid>",
    "_source": {
      "profileIds": ["<profileId>"]
    }
  }
}
```
