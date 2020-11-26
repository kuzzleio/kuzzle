---
code: false
type: page
title: Properties
description: RequestContext class properties
---

# RequestContext

Kuzzle execution context for the request.

Contains informations about identity (`token`, `user`) and origin (`connection`).

## `connection`

| Type                  | Description                                                    | get / set |
|-----------------------|----------------------------------------------------------------|-----------|
| <pre>Connection</pre> | Information about the connection at the origin of the request. | get       |

### Connection properties

| Name       | Type                  | Description                                     | get / set |
|------------|-----------------------|-------------------------------------------------|-----------|
| `id`       | <pre>string</pre>     | Unique identifier of the user connection        | get       |
| `protocol` | <pre>string</pre>     | Network protocol name                           | get       |
| `ips`      | <pre>string[]</pre>   | Chain of IP addresses, starting from the client | get       |
| `misc`     | <pre>JSONObject</pre> | Additional informations about the connection    | get       |

### HTTP misc informations

| Name      | Type              | Description  | get / set |
|-----------|-------------------|--------------|-----------|
| `path`    | <pre>string</pre> | HTTP path    | get       |
| `verb`    | <pre>string</pre> | HTTP verb    | get       |
| `headers` | <pre>string</pre> | HTTP headers | get       |

## `token`

| Type             | Description           | get / set |
|------------------|-----------------------|-----------|
| <pre>Token</pre> | Authentication token | get       |

### Token properties

| Name           | Type              | Description | get / set |
|----------------|-------------------|-------------|-----------|
| `_id`          | <pre>string</pre> | Unique ID   | get       |
| `expiresAt`    | <pre>number</pre> | Expiration date in Epoch-micro   | get       |
| `ttl`          | <pre>number</pre> | Time-to-live   | get       |
| `userId`       | <pre>string</pre> | Associated user ID   | get       |
| `connectionId` | <pre>string</pre> | Associated connection ID   | get       |
| `jwt`          | <pre>string</pre> | JWT token   | get       |
| `refreshed`    | <pre>boolean</pre> | True if the token has been refreshed with the current request   | get       |

## `user`

| Type             | Description           | get / set |
|------------------|-----------------------|-----------|
| <pre>User</pre> | Associated user | get       |

### User properties

::: info
The User class extends the JSONObject class and can contain other properties.
:::

| Name           | Type              | Description | get / set |
|----------------|-------------------|-------------|-----------|
| `_id`          | <pre>string</pre> | Unique ID   | get       |
| `profileIds`    | <pre>string[]</pre> | User profiles   | get       |

