---
code: true
type: page
title: getCredentialsById
---

# getCredentialsById

Gets credential information for the user identified by the strategy's unique user identifier `userId`.

The returned `result` object will vary depending on the strategy (see the [getById() plugin function](/core/2/guides/write-plugins/integrate-authentication-strategy#optional-getbyid)), and it can be empty.

::: info
The user identifier to use depends on the specified strategy. 
If you wish to get credential information using a [kuid](/core/2/guides/main-concepts/authentication#kuzzle-user-identifier-kuid) identifier, use the [security:getCredentials](/core/2/api/controllers/security/get-credentials) API action instead.
:::

---

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/credentials/<strategy>/<_id>/_byId
Method: GET
```

### Other protocols

```js
{
  "controller": "security",
  "action": "getCredentialsById",
  "strategy": "<strategy>",
  "_id": "<userId>"
}
```

---

## Arguments

- `_id`: user credential identifier (this is NOT the kuid)
- `strategy`: authentication strategy

::: warning
The provided `_id` is NOT the `kuid` but the credentials identifier.
For example, with the `local` strategy, the credential identifier is the `username` field.
:::

---

## Response

Returns credentials information (depend on the authentication strategy).

### Example with the "local" authentication strategy:

**KuzzleRequest:**
```js
{
  "controller": "security",
  "action": "getCredentialsById",
  "strategy": "local",
  "_id": "johndoe@kuzzle.io"
}
```

**Response:**
```js
{
  "status": 200,
  "error": null,
  "action": "getCredentialsById",
  "controller": "security",
  "result": {
    "username": "johndoe@kuzzle.io",
    "kuid": "<kuid>"
  }
}
```
