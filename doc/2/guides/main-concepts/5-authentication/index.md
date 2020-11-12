---
code: false
type: page
title: Authentication
description: Authenticate your users through the multi-strategy system
order: 500
---

# Authentication

Kuzzle handles authentication in a **generic way with a strategy system** that can be added via plugins.

These strategies are responsible for **managing user credentials** and **verifying them** during the authentication phase.

::: info
Plugins have a secure storage space accessible only from the plugin code.  
This space is used to store sensitive information such as user credentials.  
:::

Each user can then use one of the available strategies to authenticate himself.

## Kuzzle User IDentifier (kuid)

Users are identified by a unique identifier called the Kuzzle User IDentifier or `kuid`.  

This is for example the `kuid` found in the Kuzzle Metadata of documents:

```json
{
  "name": "jenow",
  "age": 32,
  "_kuzzle_info": {
    "creator": "c2eaced2-c388-455a-b018-940b68cbb5a2",
    "createdAt": 1605018219330,
    "updater": "940b940b6-c388-554a-018b-ced28cbb5a2",
    "updatedAt": 1705018219330
  }
}
```

The `kuid` is auto-generated unless it is passed to the [security:createUser](/core/2/api/controllers/security/create-user) API action:

```bash
kourou security:createUser '{           
  content: {    
    profileIds: ["default"]
  },                    
  credentials: {          
    local: {
      username: "my",
      password: "password"
    }
  }
}' --id mylehuong
```

## Credentials

In Kuzzle, a user's credentials are composed of a **list of authentication strategies and their respective profile data**.

They must be provided at the creation of a user in the `credentials` property of the user's content passed in the `body` of the query.

**Example:** _Create an user with `local` credentials_
```bash
kourou security:createUser '{
  content: {
    profileIds: ["default"]
  },
  credentials: {
    local: {
      username: "mylehuong",
      password: "password"
    }
  }
}'
```

They will then be **stored by the plugin** in charge of the `local` strategy in a **secure storage space** accessible only with the code of this plugin.

It is possible to manipulate a user's credentials:
 - [security:getCredentials](/core/2/api/controllers/security/get-credentials): retrieve credentials information for a strategy
 - [security:createCredentials](/core/2/api/controllers/security/create-credentials): create new credentials another strategy
 - [security:deleteCredentials](/core/2/api/controllers/security/delete-credentials): delete credentials for a strategy

When a user wants to authenticate to Kuzzle, he must choose a strategy and then provide the information requested by the strategy.

For example for the `local` strategy it is required to provide a `username` and a `password`:

```bash
kourou auth:login -a strategy=local --body '{
  username: "mylehuong",
  password: "password"
}'
```

## Authentication Token

Authentication is performed using the [auth:login](/core/2/api/controllers/auth/login) API action.  

This action requires the name of the strategy to be used as well as any information necessary for this strategy.

When authentication is successful, Kuzzle returns an authentication token. This token has a validity of 2 hours by default, then it will be necessary to refresh it or to ask for a new one.

::: info
It is possible to request a token authentication valid for more than 2 hours with the argument `expiresIn`.  
The default validity period is configurable under the key `security.jwt.expiresIn`.  
It is also possible to set a maximum validity period for a token under the key `security.jwt.maxTTL`.
:::

This token must then be provided in requests to the Kuzzle API to authenticate the user.

::: warning
For historical reasons the API terminology uses the term `jwt` but Kuzzle authentication tokens only have in common with JSON Web Tokens the algorithms used to generate and verify them.
:::

révocable
obtension (+ limit)
Token expiration, event (only if rt sub), 
refresh token

## `local` Strategy

password policies

## `oauth` Strategy

install
config from README
