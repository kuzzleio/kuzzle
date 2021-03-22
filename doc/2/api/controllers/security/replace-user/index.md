---
code: true
type: page
title: replaceUser
---

# replaceUser

<DeprecatedBadge version="auto-version">

Replaces a user with new configuration.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/users/<_id>/_replace[?refresh=wait_for]
Method: PUT
Body:
```

```js
{
  "profileIds": ["<profileId>"],
  // additional user properties (optional)
  "fullname": "John Doe"
}
```

### Other protocols

```js
{
  "controller": "security",
  "action": "replaceUser",
  "_id": "<kuid>",
  "body": {
    "profileIds": ["<profileId>"],
    // additional user properties (optional)
    "fullname": "John Doe"
  }
}
```

---

## Arguments

- `_id`: user [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid)

### Optional:

- `refresh`: if set to `wait_for`, Kuzzle will not respond until the user replacement is indexed (default: `"wait_for"`)

---

## Body properties

- `profileIds`: an array of security profiles attributed to the user

### Optional:

- any other property: additional user information

---

## Response

Returns the user replacement status:

- `_id`: new user kuid
- `_source`: new user content and attributed profiles

```js
{
  "status": 200,
  "error": null,
  "action": "replaceUser",
  "controller": "security",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<kuid>",
    "_source": {
      "profileIds": ["<profileId>"],
      "fullname": "John Doe"
    }
  }
}
```
