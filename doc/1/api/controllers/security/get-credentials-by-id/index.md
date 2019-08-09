---
code: true
type: page
title: getCredentialsById
---

# getCredentialsById



Gets credential information for the user identified by the strategy's unique user identifier `userId`.

The returned `result` object will vary depending on the strategy (see the [getById plugin function](/core/1/plugins/guides/strategies#optional-getbyid)), and it can be empty.

**Note:** the user identifier to use depends on the specified strategy. If you wish to get credential information using a [kuid](/core/1/guides/essentials/user-authentication#kuzzle-user-identifier-kuid) identifier, use the [getCredentials](/core/1/api/controllers/security/get-credentials) API route instead.

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

---

## Response

Returns credentials information (depend on the authentication strategy).

### Example with the "local" authentication strategy:

```js
{
  "status": 200,
  "error": null,
  "action": "getCredentialsById",
  "controller": "security",
  "result": {
    "username": "<userId>",
    "kuid": "<kuid>"
  }
}
```
