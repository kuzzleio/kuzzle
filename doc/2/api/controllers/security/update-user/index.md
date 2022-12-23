---
code: true
type: page
title: updateUser | API | Core
---

# updateUser

Updates a user definition.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/users/<_id>/_update[?refresh=wait_for][&retryOnConflict=10]
Method: PUT
Body:
```

```js
{
  "fullname": "Walter Smith"
}
```

### Other protocols

```js
{
  "controller": "security",
  "action": "updateUser",
  "_id": "<kuid>",
  "body": {
    "fullname": "Walter Smith"
  },
  // Optional
  "refresh": "wait_for",
  "retryOnConflict": 10
}
```

---

## Arguments

- `_id`: user [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid)

### Optional arguments

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the user changes are indexed (default: `"wait_for"`)
- `retryOnConflict`: in case of an update conflict in Elasticsearch, the number of retries before aborting the operation (default: `10`)

---

## Response

Returns the update user kuid and version number.

```js
{
  "status": 200,
  "error": null,
  "action": "updateUser",
  "controller": "security",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<kuid>",
    "_source": {
      "profileIds": ["<profileId>"],
      "fullname": "Walter Smith"
    }
  }
}
```
