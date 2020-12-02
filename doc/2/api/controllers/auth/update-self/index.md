---
code: true
type: page
title: updateSelf
---

# updateSelf

Updates the currently logged in user information.

This route cannot update the list of associated security profiles. To change a user's security profiles, the route [security:updateUser](/core/2/api/controllers/security/update-user) must be used instead.

---

## Query Syntax

### HTTP

<SinceBadge version="2.4.0"/>
```http
URL: http://kuzzle:7512/_me[?refresh=wait_for][?retryOnConflict=10]
Method: PUT
Headers: Authorization: "Bearer <authentication token>"
Body:
```

<DeprecatedBadge version="2.4.0">
```http
URL: http://kuzzle:7512/_updateSelf[?refresh=wait_for][?retryOnConflict=10]
Method: PUT
Headers: Authorization: "Bearer <authentication token>"
Body:
```
</DeprecatedBadge>

```js
{
    "foo": "bar",
    "fullname": "Walter Smith"
}
```

### Other protocols

```js
{
  "controller": "auth",
  "action": "updateSelf",
  "jwt": "<authentication token>",
  "body": {
    "foo": "bar",
    "name": "Walter Smith"
  },
  // Optional
  "refresh": "wait_for",
  "retryOnConflict": 10
}
```

---

## Arguments

- `jwt`: valid authentication token (for the HTTP protocol, the token is to be passed to the `Authorization` header instead)

### Optional arguments

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the user changes are indexed (default: `"wait_for"`)
- `retryOnConflict`: in case of an update conflict in Elasticsearch, the number of retries before aborting the operation (default: `10`)

---

## Body properties

User properties that can be set or updated depend on the application hosted by Kuzzle. This document is free of limitations.

---

## Response

Returns the following properties:

- `_id`: current user's [kuid](/core/2/guides/main-concepts/5-authentication#kuzzle-user-identifier-kuid)
- `_source`: additional (and optional) user properties

```js
{
  "status": 200,
  "error": null,
  "action": "updateSelf",
  "controller": "auth",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<kuid>",
    "_source": {
      "fullname": "Walter Smith"
    }
  }
}
```
