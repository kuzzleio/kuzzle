---
code: false
type: page
title: Permissions
description: Configure fine-grained permissions to your data and features
order: 400
---

<!-- need rewrite -->

# Permissions

Kuzzle provides a full set of functionalities to configure fine-grained permissions to your data and features.

---

## Initial Setup

When Kuzzle is first installed there is no administrator account and anonymous users (i.e. unauthenticated users) have administrative privileges.

To secure your Kuzzle installation you will need to create an administrator account by using the [security:createFirstAdmin](/core/2/api/controllers/security/create-first-admin) API action.

Once the administrator account is created, you can remove anonymous access rights and properly secure your installation. You can then use the Kuzzle Admin Console or Kuzzle API to create new users and assign them permissions.

---

## Whitelist strategy

In Kuzzle, permissions follow the [Whitelist](https://en.wikipedia.org/wiki/Whitelist) strategy, which means that **an action must be explicitly allowed** by at least one role of the user profile.

This means that:

- If a role allows it, the action is authorized, _even if another role denies it_.
- If no role explicitly allows it, the action is denied, even if no role explicitly denies it.

---

## User Permissions

User-level permissions control what API actions can be executed and, optionally, restrict those to targeted data indexes and collections.

### Users, Profiles and Roles

Kuzzle's security layer links users to one or more profiles.
You can think of a **profile as a group of users that share the same permissions**.

The **profiles** themselves are made up of **different groups of permissions**, these groups are called roles.

A profile is linked to a set of roles, and each role defines a set of permissions.  
For example, in the diagram below, the `editor` profile is has all permissions, the `contributor` has a subset of the permissions, and the `default` profile has only default permissions:

![Users, Profiles and Roles](./profiles-roles.png)

All roles and profiles can be edited in the [Kuzzle Admin Console](/core/2/guides/essentials/admin-console).

---

## Defining Roles

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

In the above `role` definition, anonymous users can perform the [login](/core/2/api/controllers/auth/login), [checkToken](/core/2/api/controllers/auth/check-token), [getCurrentUser](/core/2/api/controllers/auth/get-current-user) and [getMyRights](/core/2/api/controllers/auth/get-my-rights) actions of the `auth` controller.

For a list of available controllers and actions from Kuzzle's API by opening the following URL in your browser: [http://localhost:7512/?pretty](http://localhost:7512/?pretty)

---

## Defining Profiles

A **profile definition is a JSON object** that contains an optional rate limit parameter, and an array of policies.

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

### Policies

Each policy is composed of a roleId and an array of restrictions:

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
      "roleId": "publisherRole"
    }
  ]
}
```

* Applies the `publisher` role only to the index `nyc-open-data`, and to all its collections

```js
{
  "policies": [
    {
      "roleId": "publisherRole",
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
      "roleId": "publisherRole",
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

---

## Writing complex or dynamic permission rules

So far, we've seen how to set permissions to API action, using user roles and profiles.

But this is rarely enough to secure an application, as it's commonplace to reject queries or data depending on business rules.
For instance, suppose you have a chat application and you want the users to only be able to edit & delete their own messages: this type of rules cannot be expressed as a simple boolean.

There are multiple ways of adding a business logic layer on top of the standard Kuzzle security one:

* With a [Pipe Plugin](/core/2/plugins/guides/pipes), you can listen to one or multiple [API events](/core/2/plugins/guides/events), and decide whether you accept a query or document according to your business rules (you can see an example on [Github](https://github.com/kuzzleio/kuzzle-plugin-sample-custom-policies))
* If all you need is to make sure that submitted documents follow a strict set of formatting rules, you can add [document validators](/core/2/guides/cookbooks/datavalidation)
