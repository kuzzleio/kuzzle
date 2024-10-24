---
code: false
type: page
order: 400
title: Authenticate Users | Kuzzle Getting Started | Guide | Core
meta:
  - name: description
    content: Use the multi-authentication system
  - name: keywords
    content: Kuzzle, Documentation, kuzzle write pluggins, General purpose backend, Write an Application, iot, backend, opensource, realtime, Authenticate Users
---

# Authenticate Users

Kuzzle's authentication system is **multi-strategy based**. This means that the same user can **authenticate in several different ways**.

For example, the same user can authenticate with the [local](/core/2/guides/main-concepts/authentication#local-strategy) strategy with an username and a password pair but also with the [oauth](/core/2/guides/main-concepts/authentication#oauth-strategy) strategy using an external provider such as Facebook or Google.

::: info
Kuzzle uses [Passport.js](http://www.passportjs.org/) under the hood, and therefore there are 300+ strategies readily available. (LDAP, OpenID, Active Directory, x509, etc.)  
:::

We saw that in the [Set Up Permission](/core/2/guides/getting-started/set-up-permissions) guide, when creating a user, we had to provide credentials for the [local](/core/2/guides/main-concepts/authentication#local-strategy) strategy, but we could have provided more strategies (provided the right strategy plugins are used):

```js
{
  // User profiles
  content: {
    profileIds: ["dummy"]
  },

  // User credentials
  credentials: {

    // User will be able to login with the "local" strategy
    local: {
      username: "najada",
      password: "password"
    },

    // User will be able to login with the "ldap" strategy
    ldap: {
      bindDN: "cn=root",
      searchBase: "ou=passport-ldapauth",
      searchFilter: "(uid=najada)"
    }
  }
}
```

::: warning
New authentication strategies are made available by [authentication plugins](/core/2/guides/write-plugins/integrate-authentication-strategy).

By default, only the [local strategy](/core/2/guides/main-concepts/authentication#local-strategy) is available.

We also provide an authentication plugin for the [OAuth strategy](/core/2/guides/main-concepts/authentication#oauth-strategy) but it's not available by default and need to be [added to your application](/core/2/guides/develop-on-kuzzle/external-plugins).
:::

### Getting an authentication token

Kuzzle uses **authentication tokens** to identify user sessions.

First we need to get one with the [auth:login](/core/2/api/controllers/auth/login) action. This action takes the `strategy` used as a mean to authenticate, and any additional information needed by that strategy.

In our example we will use the [local](/core/2/guides/main-concepts/authentication#local-strategy) strategy so we have to provide a `username` and a `password`:

We previously created a user with the username `melis` and the password `password`. If you don't have this user, you can create it with the following command:

```bash
kourou security:createUser '{
  content: {
    profileIds: ["default"]
  },
  credentials: {
    local: {
      username: "melis",
      password: "password"
    }
  }
}'
```

Then we can log in with the following command:

#### Using API

```bash
curl -XPOST 'http://localhost:7512/_login/local' \
  -H 'Content-Type: application/json' \
  -d '{
  "username": "melis",
  "password": "password"
}'

## Response
{
  "action": "login",
  "controller": "auth",
  "error": null,
  "headers": {},
  "node": "knode-glamorous-flaubert-1113",
  "requestId": "688feaf7-d720-4d23-9ba6-cc43487f0108",
  "result": {
    "_id": "kuid-tricky-comedian-10492",
    "expiresAt": 1729776561843,
    "jwt": "kauth-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiJrdWlkLXRyaWNreS1jb21lZGlhbi0xMDQ5MiIsImlhdCI6MTcyOTc3Mjk2MSwiZXhwIjoxNzI5Nzc2NTYxfQ.m_c8h3aLxqOa45afgFgowRnQ5f4uSPG3QVKDW1taYak",
    "ttl": 3600000
  },
  "status": 200,
  "volatile": null
}
```

#### Using CLI

```bash
kourou auth:login -a strategy=local --body '{
  username: "melis",
  password: "password"
}'

## Response
[ℹ] Unknown command "auth:login", fallback to API action

 🚀 Kourou - Executes an API query.

 [ℹ] Connecting to ws://localhost:7512 ...
{
  "_id": "kuid-tricky-comedian-10492",
  "expiresAt": 1729776399610,
  "jwt": "kauth-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiJrdWlkLXRyaWNreS1jb21lZGlhbi0xMDQ5MiIsImlhdCI6MTcyOTc3Mjc5OSwiZXhwIjoxNzI5Nzc2Mzk5fQ.9rBVc4h6hV3Rsb0Z6kvLKhlZNxI-9O7xeWJnC6LfCEQ",
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

Now that we have a token, we must pass it to API requests, either in the **HTTP headers** or in the **Kuzzle request payload**, depending on what network protocol is used.

::: info
When using Kourou with `--username` and `--password` flags, the [auth:login](/core/2/api/controllers/auth/login) action is called and the received token is automatically used along with subsequent requests.
:::

#### Using API

```bash
curl -H "Authorization: Bearer <token>" http://localhost:7512/_me
```

#### Using CLI

```bash
kourou auth:getCurrentUser -a jwt=<token>
```

#### Using Websocket

```bash
npx wscat -c ws://localhost:7512 --execute '{
  "controller": "auth",
  "action": "getCurrentUser",
  "jwt": "<token>"
}'
```

#### Using javascript SDK

```bash
kourou sdk:execute '
  sdk.jwt = "<token>";
  console.log(await sdk.auth.getCurrentUser());
'
```

::: info
Kourou is able to [execute](https://github.com/kuzzleio/kourou/blob/master/README.md#kourou-sdkexecute-code) Javascript code snippets.  
A `sdk` variable is exposed and refers to an instance of the [Javascript SDK](/sdk/js/7), connected to Kuzzle and authenticated if credentials are provided.
:::

<GuidesLinks 
  :prev="{ text: 'Set up Permissions', url: '/guides/getting-started/set-up-permissions' }" 
  :next="{ text: 'Subscribe to Realtime Notifications', url: '/guides/getting-started/subscribe-realtime-notifications/' }" 
/>
