---
code: true
type: page
title: upsertUser
---

# upsertUser

<SinceBadge version="auto-version"/>

Applies partial changes to an user. If the user doesn't already exist, a new user is created.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/users/<_id>/_upsert[?refresh=wait_for][&retryOnConflict=10]
Method: POST
Body:
```

```js
{
  "content": {
    "profileIds": ["<profileId>"],
    // additional user properties (optional)
    "fullname": "John Doe"
  },
  "credentials": {
    // example with the "local" authentication strategy
    "local": {
      username: "jdoe",
      password: "foobar"
    }
  },
  "default": {
    // optional: user fields to add to the "content" part if the user
    // is created
  }
}
```

### Other protocols

```js
{
  "index": "<index>",
  "collection": "<collection>",
  "controller": "security",
  "action": "upsertuser",
  "_id": "<userId>",
  "body": {
    "content": {
      "profileIds": ["<profileId>"],
      // additional user properties (optional)
      "fullname": "John Doe"
    },
    "credentials": {
      // example with the "local" authentication strategy
      "local": {
        username: "jdoe",
        password: "foobar"
      }
    },
    "default": {
      // optional: user fields to add to the "content" part if the user
      // is created
    }
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

## Body properties

- `content`: an object describing the user. Properties:
  - `profileIds`: an array of security profiles attributed to the user
  - any other property: optional additional user information
- `credentials`: describe how the new user can be authenticated. This object contains any number of properties, named after the target authentication strategy to use. Each one of these properties are objects containing the credentials information, corresponding to that authentication strategy. If left empty, the new user is created but cannot be authenticated.
- `default`: (optional) fields to add to the user if it gets created

---

## Response

Returns information about the updated user:

- `_id`: user kuid
- `_source`: actualized user content

```js
{
  "status": 200,
  "error": null,
  "controller": "security",
  "action": "upsertUser",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<kuid>",
    "_source": {
      "profileIds": ["<profileId>"],
      "fullname": "John Doe"
    },
  }
}
```
