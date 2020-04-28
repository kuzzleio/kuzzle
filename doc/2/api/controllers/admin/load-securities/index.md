---
code: true
type: page
title: loadSecurities
---

# loadSecurities

<SinceBadge version="1.7.0" />

Load roles, profiles and users into the storage layer.

The roles, profiles and users definitions follow the same structure as in the body parameter of these corresponding API routes:

 - [createRole](/core/2/api/controllers/security/create-role)
 - [createProfile](/core/2/api/controllers/security/create-profile)
 - [createUser](/core/2/api/controllers/security/create-user)

If some users already exists, they will be deleted and then created again.

::: warning
Kuzzle prevent existing user overriding in production environment.  
You can either skip or override existing users with the `onExistingUsers` option.
:::

**Notes:**

* The body can contain any number of roles, profiles and users.
* If a role, profile or user already exists, it will be replaced.
* Fixtures are loaded sequentially: first the roles, then the profiles and finally the users. If a failure occurs, Kuzzle immediately interrupts the sequence, without rollbacking what has already been loaded.

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/admin/_loadSecurities[?refresh=wait_for][&onExistingUsers=skip|override][&force]
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

* `onExistingUsers`: can be set to either `skip` or `override` to skip or override existing users
* `refresh`: if set to `wait_for`, Kuzzle will not respond until the fixtures are loaded
* `force`: if set to `true`, creates the role even if it gives access to non-existent plugins API routes.

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
