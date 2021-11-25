---
code: true
type: page
title: loadSecurities
---

# loadSecurities

Load roles, profiles and users into the storage layer.

<!-- Duplicate section with /core/2/guides/main-concepts/3-permissions -->

The roles, profiles and users definitions follow the same structure as in the body parameter of their corresponding API actions:

 - [security:createRole](/core/2/api/controllers/security/create-role)
 - [security:createProfile](/core/2/api/controllers/security/create-profile)
 - [security:createUser](/core/2/api/controllers/security/create-user)

::: warning
By default, Kuzzle prevents existing user overwriting.
You can either skip or overwrite existing users with the `onExistingUsers` option.
:::

**Notes:**

* The body can contain any number of roles, profiles and users.
* If a role, profile or user already exists, it will be replaced.
* Fixtures are loaded sequentially: first the roles, then the profiles and finally the users. If a failure occurs, Kuzzle immediately interrupts the sequence, without rollbacking what has already been loaded.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/admin/_loadSecurities[?refresh=wait_for][&onExistingUsers=skip|overwrite|fail][&force]
Method: POST
Body:
```

```js
{
  "roles": {
    "role-id": {
      /* role definition */
    }
  },
  "profiles": {
    "profile-id": {
      /* profile definition */
    }
  },
  "users": {
    "user-id": {
      /* user definition */
    }
  }
}
```


### Other protocols


```js
{
  "controller": "admin",
  "action": "loadSecurities",
  "body": {
    "roles": {
      "role-id": {
        /* role definition */
      }
    },
    "profiles": {
      "profile-id": {
        /* profile definition */
      }
    },
    "users": {
      "user-id": {
        /* user definition */
      }
    }
  }
}
```

## Arguments

### Optional:

* `onExistingUsers`: can be set to either `fail` (default), `skip` or `overwrite` to either fail, skip or overwrite existing users
* `refresh`: if set to `wait_for`, Kuzzle will not respond until the fixtures are loaded
* `force`: if set to `true`, creates the role even if it gives access to non-existent plugins API actions.

---

## Response

Returns a confirmation that the command is being executed.

```js
{
  "requestId": "d16d5e8c-464a-4589-938f-fd84f46080b9",
  "status": 200,
  "error": null,
  "controller": "admin",
  "action": "loadSecurities",
  "collection": null,
  "index": null,
  "result": { "acknowledge": true }
}
```
