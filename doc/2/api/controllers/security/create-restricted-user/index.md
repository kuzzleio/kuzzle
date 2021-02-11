---
code: true
type: page
title: createRestrictedUser
---

# createRestrictedUser

Creates a new user in Kuzzle, with a preset list of security profiles.

The list of security profiles attributed to restricted users is fixed, and must be configured in the [Kuzzle configuration file](/core/2/guides/advanced/configuration).

This method allows users with limited rights to create other accounts, but blocks them from creating accounts with unwanted privileges (e.g. an anonymous user creating his own account).

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/users/<_id>/_createRestricted[?refresh=wait_for]
URL(2): http://kuzzle:7512/users/_createRestricted[?refresh=wait_for]
Method: POST
Body:
```

```js
{
  // user additional information (optional)
  "content": {
    "fullname": "John Doe"
  },
  "credentials": {
    // example with the "local" authentication strategy
    "local": {
      username: "jdoe",
      password: "foobar"
    }
  }
}
```

### Other protocols

```js
{
  "controller": "security",
  "action": "createRestrictedUser",
  "body": {
    // optional
    "content": {
      "fullname": "John Doe"
    },
    "credentials": {
      // example with the "local" authentication strategy
      "local": {
        username: "jdoe",
        password: "foobar"
      }
    }
  },

  // optional arguments
  "_id": "<kuid>",
  "refresh": "wait_for",
  "kuid": "human"
}
```

---

## Arguments

### Optional

- `_id`: user [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid). An error is returned if the provided identifier already exists. If not provided, a random kuid is automatically generated.
- `refresh`: if set to `wait_for`, Kuzzle will not respond until the newly created user is indexed (default: `"wait_for"`)
- `kuid`: if set to `human`, Kuzzle will generate a human readable id, otherwise if set to `uuid` Kuzzle will generate a standard uuid (default: `"human"`)

---

## Body properties

- `content`: optional user additional information.
- `credentials`: describe how the new user can be authenticated. This object contains any number of properties, named after the target authentication strategy to use. Each one of these properties are objects containing the credentials information, corresponding to that authentication strategy. If left empty, the new user is created but cannot be authenticated.

---

## Response

Returns the restricted user creation status:

- `_id`: new user kuid
- `_source`: new user content and attributed profiles
- `created`: always true
- `version`: always 1

```js
{
  "status": 200,
  "error": null,
  "controller": "security",
  "action": "createRestrictedUser",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<kuid>",
    "_source": {
      "profileIds": ["<profileId>"],
      "fullname": "John Doe"
    },
    "_version": 1,
    "created": true
  }
}
```
