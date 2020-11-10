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

For instance, if a user registered on Kuzzle with both Facebook (OAuth) and local authentication strategies, then their credentials would look like this:
```js
{
  "facebook": {
    "kuid": "<Kuzzle User IDentifier>",
    "login": "Myy",
    "email": "my@lehuong.vn"
  },
  "local": {
    "kuid": "<Kuzzle User IDentifier>"
    "username": "my-le-huong",
    "password": "**********"
  }
}
```

## Authentication Token

L'authentification se fait avec l'action [auth:login](/core/2/api/controllers/auth/login).
Les tokens d'authentification 
pas jwt, révocable
obtension (+ limit)
Token expiration, event (only if rt sub), 
refresh token

## `local` Strategy

password policies

## `oauth` Strategy

install
config from README
