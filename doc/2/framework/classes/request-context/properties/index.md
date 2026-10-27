---
code: false
type: page
title: Properties | Framework | Core

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
| `misc`     | <pre>ContextMisc</pre> | Additional informations about the connection    | get       |

### ContextMisc HTTP informations

| Name      | Type              | Description  | get / set |
|-----------|-------------------|--------------|-----------|
| `path`    | <pre>string</pre> | HTTP path    | get       |
| `verb`    | <pre>string</pre> | HTTP verb    | get       |
| `headers` | <pre>JSONObject</pre> | HTTP headers | get       |

## `token`

| Type             | Description           | get / set |
|------------------|-----------------------|-----------|
| <pre>[KuzzleToken](/core/2/framework/types/kuzzle-token)</pre> | Authentication token, or `null` if the request is not authenticated | get / set |

### Token properties

| Name           | Type              | Description | get / set |
|----------------|-------------------|-------------|-----------|
| `_id`          | <pre>string</pre> | Unique ID   | get       |
| `expiresAt`    | <pre>number</pre> | Expiration date, in milliseconds since Epoch (`-1` if the token never expires) | get       |
| `ttl`          | <pre>number</pre> | Time-to-live, in milliseconds (`-1` if the token never expires) | get       |
| `userId`       | <pre>string</pre> | Associated user ID   | get       |
| `jwt`          | <pre>string</pre> | JWT token   | get       |
| `refreshed`    | <pre>boolean</pre> | True if the token has been refreshed with the current request   | get       |
| `singleUse`    | <pre>boolean</pre> | True if the token can only be used once | get       |
| `type`         | <pre>'apiKey' &#124; 'authToken'</pre> | `apiKey` for an [API key](/core/2/guides/advanced/api-keys), `authToken` otherwise | get       |

::: info
The token does not hold the ID of the connection it is used on: use [connection.id](#connection-properties) instead.
:::

## `user`

| Type             | Description           | get / set |
|------------------|-----------------------|-----------|
| <pre>[KuzzleUser](/core/2/framework/types/kuzzle-user)</pre> | Associated user, or `null` | get / set |

### User properties

::: info
The User class extends the JSONObject class and can contain other properties.
:::

| Name           | Type              | Description | get / set |
|----------------|-------------------|-------------|-----------|
| `_id`          | <pre>string</pre> | Unique ID   | get       |
| `profileIds`    | <pre>string[]</pre> | User profiles   | get       |

