---
code: false
type: page
title: Authentication
description: Authenticate users
order: 400
---

# Authentication

Kuzzle authentication system is multi-strategy based. This means that the same user can authenticate in several different ways.

For example, the same user can authenticate with the `local` strategy with an username and a password pair but also with the `oauth` strategy using an external provider such as Facebook or Google.

::: info
Kuzzle uses [Passport.js](http://www.passportjs.org/packages/) under the hood, and therefore there are 300+ strategies readily available. (LDAP, OpenID, Active Directory, x509, etc.)  
:::

We saw that in the [Access Control Rights](/core/2/guides/getting-started/3-access-control-rights) guide, when creating a user, we had to provide credentials for the `local` strategy, but we could have provided more strategies (provided the right strategy plugins are installed):

```bash
$ kourou security:createUser '{
  content: {
    profileIds: ["dummy"]
  },
  credentials: {
    local: {
      username: "yagmur",
      password: "password"
    },
    ldap: {
      bindDN: "cn=root",
      searchBase: "ou=passport-ldapauth",
      searchFilter: "(uid=yagmur)"
    }
  }
}'
```

### Getting an authentication token

Kuzzle uses authentication tokens to identify user sessions.  

First we need to get one with the [auth:login](/core/2/api/controllers/auth/login) action. This action takes the `strategy` used as a mean to authenticate, and any additional information needed by that strategy.

In our example we will use the `local` strategy so we have to provide a `username` and a `password`:

```bash
$ kourou auth:login -a strategy=local -a username=yagmur -a password=password
[ℹ] Unknown command "auth:login", fallback to API method
 
 🚀 Kourou - Executes an API query.
 
 [ℹ] Connecting to http://localhost:7512 ...
 {
  "_id": "62843356-d826-42fb-adf1-e930e90b6006",
  "expiresAt": 1602600225701,
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2Mjg0MzM1Ni1kODI2LTQyZmItYWRmMS1lOTMwZTkwYjYwMDYiLCJpYXQiOjE2MDI1OTY2MjUsImV4cCI6MTYwMjYwMDIyNX0.0HZF_AhyTzPCRxdaMbT6hlwLflYG4emmLlTD6YV_Nmo",
  "ttl": 3600000
 }
 [✔] Successfully executed "auth:login"
```

Kuzzle sent us back the token in the `jwt` property

::: warning
Usually, login attempts are made by anonymous users, to acquire a token granting the necessary rights to perform more actions.

Since removing rights to the `auth:login` action from anonymous users would mean that it would be no longer possible to log in, Kuzzle prevents that action from ever be removed from the `anonymous` role.
:::

### Using an authentication token

Now that we have a token, we must pass it to API queries, either in the HTTP headers or in the request payload, depending on what network protocol is used.

::: info
When using Kourou with `--username` and `--password` flags, the [auth:login](/core/2/api/controllers/auth/login) action is called and the received token is automatically used along with subsequent requests.
:::

:::: tabs
::: tab Kourou

```bash
$ kourou auth:getCurrentUser --jwt <token>
```

:::
::: tab HTTP

``` bash
curl -H "Authorization: Bearer <token>" http://localhost:7512/_me
```

:::
::: tab WebSocket

```bash
$ npx wscat -c ws://localhost:7512 --execute '{
  "controller": "auth",
  "action": "getCurrentUser",
  "jwt": "<token>"
}'
```

:::
::::

Learn how to integrate a new strategy with a [strategy plugin](/core/2/some-link).
