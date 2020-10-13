---
code: false
type: page
title: Authentication
description: Authenticate users
order: 400
---

# Authentication

Kuzzle authentication system is multi-strategy. This means that the same user can authenticate in several different ways.

For example, the same user can authenticate with the `local` strategy with an username and a password pair but also with the `oauth` strategy using an external provider such as Facebook or Google.

::: info
Kuzzle uses [Passport.js](http://www.passportjs.org/packages/) internally and therefore the 300+ strategies are made available. (LDAP, Active Directory, x509, etc.)  
See [how to integrate a new strategy](/core/2/some-link-on-integrating-new-strategy)
:::

### Get an authentication token

Kuzzle uses authentication token.  

First we need to get one with the [auth:login](/core/2/api/controllers/auth/login) action. This action takes the `strategy` used to authenticate and any information needed by the strategy.

In our example we will use the `local` strategy so we have to provide an `username` and a `password`:

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
When executing the [auth:login](/core/2/api/controllers/auth/login) action, the anonymous user rights will apply.

So if the anonymous user does not have the rights to execute this action, then no one will be able to login.
:::

### Use an authentication token

Now that we have a token, we must be pass it in the HTTP headers or in the request payload.

::: info
When using Kourou with `--username` and `--password` flags, the [auth:login](/core/2/api/controllers/auth/login) action is called and the received token is sent with the next request.
:::

:::: tabs
::: tab HTTP

``` bash
curl -H "Authorization: Bearer <token>" http://localhost:7512/_me
```

:::
::: tab Others

Request payload format:

```json
{
  "controller": "auth",
  "action": "getCurrentUser",
  "jwt: "<token>"
}
```

You can try to send an authenticated with the WebSocket protocol with [wscat](https://www.npmjs.com/package/wscat):

```bash
$ npx wscat -c ws://localhost:7512 --execute '{ "controller": "auth", "action": "getCurrentUser", "jwt": "<token>" }'
```

:::
::::
