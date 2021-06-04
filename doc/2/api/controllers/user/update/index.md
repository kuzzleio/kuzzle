---
code: true
type: page
title: update
---

# update

<SinceBadge version="auto-version"/>

Updates a user definition.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/user/<_id>/_update[?refresh=wait_for][&retryOnConflict=10]
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
  "controller": "user",
  "action": "update",
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

Returns the updated user.

```js
{
  "status": 200,
  "error": null,
  "action": "update",
  "controller": "user",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<kuid>",
    "_source": {
      // User content
    }
  }
}
```
