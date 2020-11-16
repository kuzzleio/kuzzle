---
code: false
type: page
title: Set up Permissions
description: Define user rights
order: 300
---

# Set up Permissions

As in any backend, Kuzzle allows you to **restrict access to its features and data**, depending on the querying users.

The permissions system is designed following a standard model and is structured in 3 dimensions:
 - **role**: whitelist of allowed API actions
 - **profile**: combination of one or more roles
 - **user**: combination of one or more profiles

![roles, profiles and users](./role-profile-user.png)

## Role

First, we are going to create a new role with the [security:createRole](/core/2/api/controllers/security/create-role) action.

The following role description gives access to [auth:getCurrentUser](/core/2/api/controllers/auth/get-current-user) and to the [server:info](/core/2/api/controllers/auth/get-current-user) actions only.

```bash
kourou security:createRole '{
  controllers: {
    auth: {
      actions: {
        getCurrentUser: true
      }
    },
    server: {
      actions: {
        now: true
      }
    }
  }
}' --id dummy
```

You should see your newly created role in the `Security > Roles` section of the [Admin Console](http://next-console.kuzzle.io)

![Admin Console roles display](./admin-console-roles.png)

## Profile

Then, we are going to create a profile which uses our newly created role. For this we will use the [security:createProfile](/core/2/api/controllers/security/create-profile) action:

```bash
kourou security:createProfile '{
  policies: [
    { roleId: "dummy" }
  ]
}' --id dummy
```

Now we have a `dummy` profile which gives access to the API actions allowed by the `dummy` role.

You should see your newly created profile in the `Security > Profiles` section of the [Admin Console](http://next-console.kuzzle.io)

![Admin Console profiles display](./admin-console-profiles.png)

## User

Finally, we need a user attached to the `dummy` profile. The API action to create a user is [security:createUser](/core/2/api/controllers/security/create-user).

Users need to have at least one assigned profile. We also will have to give our user some credentials to be able to log in with it.

For this we will use the [security:createUser](/core/2/api/controllers/security/create-user) action:
```bash
kourou security:createUser '{
  content: {
    profileIds: ["dummy"]
  },
  credentials: {
    local: {
      username: "melis",
      password: "password"
    }
  }
}'
```

You should see your newly created role in the `Security > Users` section of the [Admin Console](http://next-console.kuzzle.io)

![Admin Console users display](./admin-console-users.png)

## Creating an administrator account, and restricting anonymous user rights

When you are not authenticated, your requests are executed as the `anonymous` user.

As with any other user, the `anonymous` user has a profile assigned (named `anonymous`), and thus a role (named `anonymous` as well).

::: info
By default, the `anonymous` role gives access to all API actions. This is intended to make development easier, but it's definitively not suitable for production.
:::

It's recommended to use the [security:createFirstAdmin](/core/2/api/controllers/security/create-first-admin) action to create an administrator user, and to restrict anonymous user rights.

::: info
The [security:createFirstAdmin](/core/2/api/controllers/security/create-first-admin) action creates a user attached to the `admin` profile, which uses the `admin` role, giving access to all API actions.  
The `reset` option allows to restrict `anonymous` default rights in the same time.
:::

This way you can always access the complete API through this admin account.

```bash
kourou security:createFirstAdmin '{
  credentials: {
    local: {
      username: "admin",
      password: "password"
    }
  }
}' -a reset=true
```

#### Try the API as the anonymous user

Try to run the following command: `kourou server:now`

You should get the following error because now the anonymous user is restricted to only a few API actions:

```bash
kourou server:now

[ℹ] Unknown command "server:now", fallback to API method
 
 🚀 Kourou - Executes an API query.
 
 [ℹ] Connecting to http://localhost:7512 ...
 [X] UnauthorizedError: Unauthorized: authentication required to execute the action "server:now". -1
    [...Kuzzle internal calls deleted...]
    at Funnel.checkRights (/var/app/lib/api/funnel.js:374:28)
        status: 401
        id: security.rights.unauthorized
```

#### Try the API as an authenticated user

Run the same command, authenticating with the user we just created: `kourou server:now --username melis --password password`

We are allowed to use this API action because **we are now authenticated with a user** with sufficient rights.

```bash
kourou server:now --username melis --password password

[ℹ] Unknown command "server:now", fallback to API method
 
 🚀 Kourou - Executes an API query.
 
 [ℹ] Connecting to http://localhost:7512 ...
 [ℹ] Loggued as melis.
 {
  "now": 1602591681683
}
 [✔] Successfully executed "server:now"
```

::: info
You can now reset anonymous rights to default to make the rest of this tutorial easier:
```bash
kourou security:updateRole '{
  controllers: {
    "*": {
      actions: {
        "*": true
      }
    }
  }
}' --id anonymous --username admin --password password
```
:::

<GuidesLinks 
  :prev="{ text: 'Store and Access Data', url: '/guides/getting-started/2-store-and-access-data/' }"
  :next="{ text: 'Authenticate Users', url: '/guides/getting-started/4-authenticate-users/' }" 
/>
