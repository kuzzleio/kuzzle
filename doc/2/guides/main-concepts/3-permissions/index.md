---
code: false
type: page
title: Permissions
description: Configure fine-grained permissions to your data and features
order: 300
---

<!-- need rewrite -->

# Permissions

Kuzzle provides a full set of functionalities to configure fine-grained permissions to your data and features.

Kuzzle's security layer links users to one or more profiles.
You can think of a **profile as a group of users that share the same permissions**.

The **profiles** themselves are made up of **different groups of permissions**, these groups are called roles.

A profile is linked to a set of roles, and each role defines a set of permissions.  
For example, in the diagram below, the `editor` profile is has all permissions, the `contributor` has a subset of the permissions, and the `default` profile has only default permissions:

![Users, Profiles and Roles](./profiles-roles.png)

Roles, profiles and users can be edited in the [Admin Console](http://console.kuzzle.io).

---

## Initial Setup

When you run your application for the first time there is no administrator account and anonymous users (i.e. unauthenticated users) can execute any API action.

To secure your application you will need to create an administrator account by using the [security:createFirstAdmin](/core/2/api/controllers/security/create-first-admin) API action.

::: info
The [security:createFirstAdmin](/core/2/api/controllers/security/create-first-admin) action creates a user attached to the `admin` profile, which uses the `admin` role, giving access to all API actions.  
The `reset` option allows to restrict `anonymous` default rights in the same time.
:::

```bash
$ kourou security:createFirstAdmin '{
  credentials: {
    local: {
      username: "admin",
      password: "password"
    }
  }
}' -a reset=true
```

Once the administrator account is created, and anonymous access rights are removed, you can properly secure your installation.  

::: info
You can then use the [Admin Console](http://console.kuzzle.io) or Kuzzle API to create new users and assign them permissions.
:::
---

## Roles

Les roles permettent de définir une liste d'action d'API qui seront authorisées.

A **role can be defined using a hierarchical JSON object** where permissions are outlined by `controller` and `action`.

The role definition is represented as a JSON object where each key at the root of the object identifies a `controller` by name.

```js
{
  "controllers": {
    "<controller name|*>": {
      "actions": {
        "<action name|*>": true,
        "<action name|*>": false,
        // ...
      }
    }
  }
}
```

The `controllers` and `actions` properties can be set to a specific value or to the wildcard value "\*".

When `controller` is declared within a Plugin, its name must be prefixed with the name of the Plugin, like `< plugin-name/controller-name >`.

The **action permission value is a boolean**. If `true`, the role allows the given action.

As an example, below is the role definition that Kuzzle uses to request authorization from the anonymous user once the administrator account is created and anonymous access is blocked.

```js
{
  "controllers": {
    "auth": {
      "actions": {
        "login": true,
        "checkToken": true,
        "getCurrentUser": true,
        "getMyRights": true
      }
    }
  }
}

```

In the above role definition, anonymous users can perform the following actions [auth:login](/core/2/api/controllers/auth/login), [auth:checkToken](/core/2/api/controllers/auth/check-token), [auth:getCurrentUser](/core/2/api/controllers/auth/get-current-user) and [auth:getMyRights](/core/2/api/controllers/auth/get-my-rights).

::: info
Default roles and profiles used once the administrator account is created with the [security:createFirstAdmin](/core/2/api/controllers/security/create-first-admin) action can be configured under the [security.default](/core/2/guides/advanced/8-configuration) configuration key.
:::

For a list of available controllers and actions from Kuzzle's API by opening the following URL in your browser: [http://localhost:7512/?pretty](http://localhost:7512/?pretty)

### Whitelist strategy

In Kuzzle, permissions follow the [Whitelist](https://en.wikipedia.org/wiki/Whitelist) strategy, which means that **an action must be explicitly allowed** by at least one role of the user profile.

This means that:

- If a role allows it, the action is authorized, **even if another role denies it**.
- If no role explicitly allows it, the action is denied, even if no role explicitly denies it.

### Associated API actions

 - [security:createOrReplaceRole](/core/2/api/controllers/security/create-or-replace-role/)
 - [security:createRole](/core/2/api/controllers/security/create-role/)
 - [security:deleteRole](/core/2/api/controllers/security/delete-role/)
 - [security:getRole](/core/2/api/controllers/security/get-role/)
 - [security:getRoleMapping](/core/2/api/controllers/security/get-role-mapping/)
 - [security:mDeleteRoles](/core/2/api/controllers/security/m-delete-roles/)
 - [security:mGetRoles](/core/2/api/controllers/security/m-get-roles/)
 - [security:searchRoles](/core/2/api/controllers/security/search-roles/)
 - [security:updateRole](/core/2/api/controllers/security/update-role/)
 - [security:updateRoleMapping](/core/2/api/controllers/security/update-role-mapping/)

---

## Profiles

Profiles are used to group the rights of several roles. They can then be assigned to users.

::: warning
You cannot remove a profile that is assigned to at least one user.  
You can use the `onAssignedUsers` option of the [security:deleteProfile](/core/2/api/controllers/security/delete-profile) action to remove a profile from it's assigned users before deleting it.
:::

A **profile definition is a JSON object** that contains an optional rate limit parameter, and an array of policies.

### Policies

Each policy is composed of a `roleId` and an array of restrictions:

```js
{
  "policies": [
    {
      // Applied to all indexes and collections
      "roleId": "<role identifier>"
    },
    {
      // Restricted to a list of indexes or to a list of collections
      "roleId": "<another role identifier>",
      "restrictedTo": [
        {
          // All collections of this index are allowed
          "index": "<another index name>"
        },
        {
          // Only the specified list of collections are allowed
          "index": "<an authorized index name>",
          "collections": [
            "<authorized collection 1>",
            "<authorized collection 2>",
            "<...>"
          ]
        }
      ]
    }
  ]
};
```

When adding a role to a profile, by default, **it impacts all indexes and collections**. For more precise control, roles can be restricted to specific indexes or collections.

For example, consider a `publisher` role allowing any action on the `document` controller:

```js
{
  "controllers": {
    "document": {
      "actions": {
        "*": true
      }
    }
  }
}
```

Three different profiles can be created using that same role, each with varying index/collections restrictions:

* Applies the `publisher` role to all indexes and collections

```js
{
  "policies": [
    {
      "roleId": "publisher"
    }
  ]
}
```

* Applies the `publisher` role only to the index `nyc-open-data`, and to all its collections

```js
{
  "policies": [
    {
      "roleId": "publisher",
      "restrictedTo": [
        {
          "index": "nyc-open-data"
        }
      ]
    }
  ]
}
```

* Applies the `publisher` role only to the collections `yellow-taxi` and `green-taxi` in the index `nyc-open-data`, and then to the index `mtp-open-data` and all its collections

```js
{
  "policies": [
    {
      "roleId": "publisher",
      "restrictedTo": [
        {
          "index": "nyc-open-data", 
          "collections": ["yellow-taxi", "green-taxi"]
        },
        { 
          "index": "mtp-open-data"
        }
      ]
    }
  ]
}
```

::: info
Role restriction on indexes and collections can be used to **easily build multi-tenant application** were different groups of users cannot see each other data.
:::

### Rate limit

<SinceBadge version="2.1.0" />

The rate limit parameter controls how many API requests a user can send, **per second and per node**. Further requests made by a user that exceed the limit are rejected with a `429 Too Many Requests` error.

::: info
If no rate limit is defined, or if it is set to 0, then no limit is applied.
If a user has several profiles with rate limits, the most permissive limit applies.
:::

::: warning
Since unauthenticated users share the same user identifier, a rate limit set on the `anonymous` profile is applied to **all anonymous requests cumulated**, per second and per node. Except for the `auth:login` route, which is statically controlled in Kuzzle's configuration files.
:::

Example:

```js
{
  "rateLimit": 20,
  "policies": [ /* ...role policies, see below ... */ ]
}
```

### Associated API actions

 - [security:createOrReplaceProfile](/core/2/api/controllers/security/create-or-replace-profile/)
 - [security:createProfile](/core/2/api/controllers/security/create-profile/)
 - [security:deleteProfile](/core/2/api/controllers/security/delete-profile/)
 - [security:getProfile](/core/2/api/controllers/security/get-profile/)
 - [security:getProfileMapping](/core/2/api/controllers/security/get-profile-mapping/)
 - [security:getProfileRights](/core/2/api/controllers/security/get-profile-rights/)
 - [security:mDeleteProfiles](/core/2/api/controllers/security/m-delete-profiles/)
 - [security:mGetProfiles](/core/2/api/controllers/security/m-get-profiles/)
 - [security:scrollProfiles](/core/2/api/controllers/security/scroll-profiles/)
 - [security:searchProfiles](/core/2/api/controllers/security/search-profiles/)
 - [security:updateProfile](/core/2/api/controllers/security/update-profile/)
 - [security:updateProfileMapping](/core/2/api/controllers/security/update-profile-mapping/)

---

## Users

Users can be assigned multiple profiles. These profiles will give them access to API actions via roles and their access will be limited by any restrictions defined in the profiles.

Users are internal documents stored by Kuzzle. They contain two properties:
 - `content`: profiles list and custom content
 - `credentials`: available authentication credentials

::: warning
The information contained in the `credentials` property are never returned and can only be accessed by the plugin that added the associated [authentication strategy](/core/2/guides/write-plugins/3-integrate-authentication-strategy).
More information about [Authentication](/core/2/some-link).
:::

### Profiles list

The list of profiles assigned to a user is contained in the `content.profileIds` property.  
This property is a list of profile identifiers:

```js
{
  "content": {
    "profileIds": ["publisher", "reader"]
  }
}
```

::: info
Users must be assigned to at least one profile.
:::

### Custom content

It is also possible to store custom data in the user object.  

Those data must be stored in the `content` property alongside the profile list:

```js
{
  "content": {
    "profileIds": ["publisher", "reader"],

    // custom data
    "firstname": "Clément",
    "lastname": "M'bileau"
  }
}
```

::: info
As any other collection, the `users` collection has an associated mapping who can be edited using the [security:updateUserMapping](/core/2/api/controllers/security/update-user-mapping/) API action.
:::

### Associated API actions

 - [security:createRestrictedUser](/core/2/api/controllers/security/create-restricted-user/)
 - [security:createUser](/core/2/api/controllers/security/create-user/)
 - [security:deleteUser](/core/2/api/controllers/security/delete-user/)
 - [security:getUser](/core/2/api/controllers/security/get-user/)
 - [security:getUserMapping](/core/2/api/controllers/security/get-user-mapping/)
 - [security:getUserRights](/core/2/api/controllers/security/get-user-rights/)
 - [security:mDeleteUsers](/core/2/api/controllers/security/m-delete-users/)
 - [security:mGetUsers](/core/2/api/controllers/security/m-get-users/)
 - [security:replaceUsers](/core/2/api/controllers/security/replace-users/)
 - [security:scrollUsers](/core/2/api/controllers/security/scroll-users/)
 - [security:searchUsers](/core/2/api/controllers/security/search-users/)
 - [security:updateUser](/core/2/api/controllers/security/update-user/)
 - [security:updateUserMapping](/core/2/api/controllers/security/update-user-mapping/)

User credentials related API actions:

 - [security:getCredentials](/core/2/api/controllers/security/get-credentials/)
 - [security:getCredentialsById](/core/2/api/controllers/security/get-credentials-by-id/)
 - [security:hasCredentials](/core/2/api/controllers/security/has-credentials/)


## Writing complex or dynamic permission rules

So far, we've seen how to set permissions to API action, using user roles and profiles.

But this is rarely enough to secure an application, as it's commonplace to **reject queries or data depending on business rules**.

For instance, suppose you have a chat application and you want the users to only be able to edit & delete their own messages: this type of rules cannot be expressed as a simple boolean.

There are multiple ways of adding a business logic layer on top of the standard Kuzzle security one:

* With a [Pipe](/core/2/guides/develop-on-kuzzle/3-event-system#pipes), you can listen to one or multiple [API events](/core/2/some-link), and decide whether you accept a query or document according to your business rules (you can see an example on [Github](https://github.com/kuzzleio/kuzzle-plugin-sample-custom-policies))
* If all you need is to make sure that submitted documents follow a strict set of formatting rules, you can add [document validators](/core/2/guides/advanced/9-data-validation)

::: info
More information about dynamic rules with pipes: [Event System](/core/2/some-link)
::: 