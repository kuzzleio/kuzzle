---
code: true
type: page
title: createFirstAdmin | API | Core
---

# createFirstAdmin

Creates a Kuzzle administrator account, only if none exist.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_createFirstAdmin/<kuid>[?reset][&refresh=wait_for]
URL(2): http://kuzzle:7512/_createFirstAdmin[?reset][&refresh=wait_for]
Method: POST
Body:
```

```js
{
  // administrator additional information (optional)
  "content": {
  },
  "credentials": {
    // for example, with the "local" authentication strategy:
    "local": {
      "username": "userAdmin",
      "password": "myPassword"
    }
  }
}
```

### Other protocols

```js
{
  "controller": "security",
  "action": "createFirstAdmin",
  "body": {
    "content": {
      // administrator information (optional)
    },
    "credentials": {
      // for example, with the "local" authentication strategy:
      "local": {
        "username": "userAdmin",
        "password": "myPassword"
      }
    }
  },
  // optional
  "reset": <boolean>,
  "refresh": "wait_for",
  "_id": "<kuid>",
  "kuid": "human"
}
```

---

## Arguments

### Optional:

- `_id`: specify the administror [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid), instead of letting Kuzzle generate a random identifier.
- `reset` (boolean): if true, restricted rights are applied to the `anonymous` and `default` roles (by default, these roles don't have any restriction). This is the same as calling [`restrictDefaultRights`](/core/2/api/controllers/security/restrict-default-rights) after this call.
- `refresh`: if set to `wait_for`, Kuzzle will not respond until the new administrator is indexed (default: `"wait_for"`)
- `kuid`: if set to `human`, Kuzzle will generate a human readable id, otherwise if set to `uuid` Kuzzle will generate a standard uuid (default: `"human"`)

---

## Body properties

- `content`: optional additional information
- `credentials`: describe how the new administrator can be authenticated. This object must contain one or multiple properties, named after the target authentication strategy to use. Each one of these properties are objects containing the credentials information, corresponding to that authentication strategy

---

## Response

Returns information about the newly created administrator:

- `_id`: administrator kuid
- `_source`: administrator user document, contains all properties set in the `content` body argument, but also the list of attributed `profileIds`. That list is initialized with the `admin` profile

```js
{
  "status": 200,
  "error": null,
  "controller": "security",
  "action": "createFirstAdmin",
  "volatile": {},
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<kuid>",                  // The kuzzle user identifier
    "_source": {
      "name": "John Doe",
      "profileIds": [
        "admin"
      ]
    }
  }
}
```

---

## Possible errors

- [Common errors](/core/2/api/errors/types#common-errors)
- [PreconditionError](/core/2/api/errors/types#preconditionerror): an administrator already exists (`api.process.admin_exists`)
- [BadRequestError](/core/2/api/errors/types#badrequesterror): for instance, `body.content.profileIds` is set (`api.assert.forbidden_argument`)
