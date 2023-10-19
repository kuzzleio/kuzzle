---
code: false
type: page
order: 200
title: API Keys | Kuzzle Advanced | Guide | Core
meta:
  - name: description
    content: Manage Kuzzle API keys
  - name: keywords
    content: Kuzzle, Documentation, kuzzle write pluggins, General purpose backend, opensource, API Keys
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
Possible values:

- `<= -1`: disable the use of maxTTL
- `>= 0`: enable maxTTL with setted value (`0` will invalid all your API keys at their creation)
  :::

It is also necessary to **provide a description** of the API key.

**Example: _Create an API key for the user "ricky" and valid for 30 days_**

```bash
kourou api-key:create ricky --description "Cron API key" --expire "30d"
```

![api-key](../../../screenshots/api-key-create.png)

Kourou returns a response containing the token authentication linked to the API key.

### API Key properties

::: warning
The authentication token property will never be returned by Kuzzle again. If you lose it, you'll have to delete the API key and recreate a new one.
:::

| Property      | Description                                                                      |
| ------------- | -------------------------------------------------------------------------------- |
| `description` | Description                                                                      |
| `expiresAt`   | expiration date in UNIX micro-timestamp format (`-1` if the token never expires) |
| `fingerprint` | SHA256 hash of the authentication token                                          |
| `token`       | Authentication token associated with this API key                                |
| `ttl`         | Original TTL                                                                     |
| `userId`      | User [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier)  |

## Search for API Keys

It is possible to search in its own API keys ([auth:searchApiKeys](/core/2/api/controllers/auth/search-api-keys)) or in those of all users ([security:searchApiKeys](/core/2/api/controllers/security/search-api-keys)).

In order to search an API key for a user, you can use kourou `api-key:search` command.

```bash
kourou api-key:search ricky
```

![api-key](../../../screenshots/api-key-search.png)

::: info
The associated authentication token is not returned by Kuzzle.
:::

## Delete API Key

It is possible to use the [auth:deleteApiKey](/core/2/api/controllers/auth/delete-api-key) and the [security:deleteApiKey](/core/2/api/controllers/security/delete-api-key) methods to delete API keys.

Once an API key is deleted, the **associated authentication token will be revoked** and cannot be used anymore.

```bash
kourou api-key:delete ricky 7ef0022d-a5e2-429b-ab8f-5b6065d345e7
```

![api-key](../../../screenshots/api-key-delete.png)


## Check API Key

It is possible to check the validity of an API Key by running

**Example: _Check the validity of the API key `kapikey-eyJ...2dos`_**
```bash
kourou api-key:check kapikey-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiJyaWNreSIsImlhdCI6MTY5NzQ2OTU5NCwiZXhwIjoxNzAwMDYxNTk0fQ.pTuBOPaRoV9VpxuWI6HufxdbSDAbcPK5PNTmHHS2dos
```

![api-key](../../../screenshots/api-key-check.png)