---
code: false
type: page
title: API Keys
description: Manage API keys 
order: 200
---

# API Keys

Kuzzle allows to create API keys to **authenticate users without using an authentication strategy** and the [auth:login](/core/2/api/controllers/auth/login) action.

An API key is associated with a standard [authentication token](/core/2/guides/main-concepts/authentication#authentication-token) that can then be used to [authenticate users](/core/2/api/controllers/auth/login) to the Kuzzle API.

The **authentication tokens** associated to these API keys **may never expire**. It is also possible to **revoke them** at any time by deleting the associated API key.

## Create an API Key

Users can create API keys for their personal use with the [auth:createApiKey](/core/2/api/controllers/auth/create-api-key) action.

Administrators can create API keys for other users using the [security:createApiKey](/core/2/api/controllers/security/create-api-key) action.

By default, **API keys do not expire**. But it is possible to specify the duration of an API key using the argument `expiresIn`.

::: info
It is also possible to set a maximum validity period for an API key under the key `security.apiKey.maxTTL` in the Kuzzle configuration.
This limit will only apply to API key created with the `auth` controller.
:::

It is also necessary to **provide a description** of the API key.

**Example: _Create an API key for the user "melis" and valid for 30 days_**
```bash
kourou security:createApiKey '{ description: "Cron API key" }' \
  -a expiresIn=30d \
  -a userId=melis
```

<details><summary>API response</summary>

```js
{
  "description": "Cron API key",
  "expiresAt": 1608466769443,
  "fingerprint": "b9aeb4703bf1f4bf3bf05dd39d0546763a375f38d9220aa8b803251e58927b5a",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiItMSIsImlhdCI6MTYwNTg3NDc2OSwiZXhwIjoxNjA4NDY2NzY5fQ.8O6Nq6qTRcQCiU1YcOiXnGrsZj-kDIMi0awtX3kofio",
  "ttl": 2592000000,
  "userId": "melis",
  "_kuzzle_info": {
    "author": "melis",
    "createdAt": 1605874769445,
    "updatedAt": null,
    "updater": null
  }
}
```

</details>


Kuzzle returns a response containing the token authentication linked to the API key in the `token` property.

### API Key properties

::: warning
The authentication token provided in the `token` property will never be returned by Kuzzle again. If you lose it, you'll have to delete the API key and recreate a new one.
:::

| Property      | Description                                                                       |
|---------------|-----------------------------------------------------------------------------------|
| `description` | Description                                                                       |
| `expiresAt`   | expiration date in UNIX micro-timestamp format (`-1` if the token never expires)  |
| `fingerprint` | SHA256 hash of the authentication token                                           |
| `token`       | Authentication token associated with this API key                                 |
| `ttl`         | Original TTL                                                                      |
| `userId`      | User [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier) |

## Search for API Keys

It is possible to search in its own API keys ([auth:searchApiKeys](/core/2/api/controllers/auth/search-api-keys)) or in those of all users ([security:searchApiKeys](/core/2/api/controllers/security/search-api-keys)).


In order to know to which API key an authentication token corresponds, it is possible to use the `fingerprint` property which is a SHA256 hash of the token.

```bash
# use sha256sum to compute the fingerprint of the authentication token
echo -n "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiItMSIsImlhdCI6MTYwNTg3NDc2OSwiZXhwIjoxNjA4NDY2NzY5fQ.8O6Nq6qTRcQCiU1YcOiXnGrsZj-kDIMi0awtX3kofi
o" | sha256sum
# b9aeb4703bf1f4bf3bf05dd39d0546763a375f38d9220aa8b803251e58927b5a

kourou security:searchApiKeys -a userId=melis '{ term: { fingerprint: "b9aeb4703bf1f4bf3bf05dd39d0546763a375f38d9220aa8b803251e58927b5a" } }'
```
<details><summary>API response</summary>

```js
{
  "hits": [
    {
      "_id": "PLuY5XUBTiOVkQBqXikm",
      "_source": {
        "description": "Cron API key",
        "expiresAt": 1608466769443,
        "fingerprint": "b9aeb4703bf1f4bf3bf05dd39d0546763a375f38d9220aa8b803251e58927b5a",
        "ttl": 2592000000,
        "userId": "melis"
      }
    }
  ],
  "total": 1
}
```

</details>

::: info
The associated authentication token is not returned by Kuzzle.
:::

## Delete API Key

It is possible to use the [auth:deleteApiKey](/core/2/api/controllers/auth/delete-api-key) and the [security:deleteApiKey](/core/2/api/controllers/security/delete-api-key) methods to delete API keys.

Once an API key is deleted, the **associated authentication token will be revoked** and cannot be used anymore.

```bash
kourou security:deleteApiKey -userId=melis --id PLuY5XUBTiOVkQBqXikm
```
