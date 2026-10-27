---
code: false
type: page
title: KuzzleToken | Framework | Core

description: KuzzleToken type definition
---

# KuzzleToken

<SinceBadge version="2.57.0" />

The `KuzzleToken` type represents the authentication token used by a request, as Kuzzle knows it on the server side. It is the type of [request.context.token](/core/2/framework/classes/request-context/properties), which is `null` when the request carries no token.

It is a type-only export: plugins and applications read it, but do not create it.

::: info
Unlike the `Token` interface also exported by `kuzzle`, `KuzzleToken` has no `connectionId`: Kuzzle tracks the connections using a token itself, not on the token.
:::

## Properties

| Property    | Type                                   | Description                                                                                                       |
| ----------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `_id`       | <pre>string</pre>                      | Token unique identifier (`<kuid>#<jwt>`)                                                                          |
| `expiresAt` | <pre>number</pre>                      | Expiration date, in Epoch-millis (`-1` if the token never expires)                                                |
| `jwt`       | <pre>string</pre>                      | The encoded token (JSON Web Token), as sent by the client                                                         |
| `refreshed` | <pre>boolean</pre>                     | `true` if the token has been refreshed                                                                            |
| `singleUse` | <pre>boolean</pre>                     | `true` if the token is valid for one request only                                                                 |
| `ttl`       | <pre>number</pre>                      | Original time to live of the token, in milliseconds (`-1` if the token never expires)                             |
| `type`      | <pre>'apiKey' &#124; 'authToken'</pre> | (getter) `apiKey` for the token of an [API key](/core/2/guides/advanced/api-keys), `authToken` otherwise          |
| `userId`    | <pre>string</pre>                      | Unique identifier (kuid) of the token owner                                                                       |

An anonymous request carries the anonymous token: its `userId` is `-1`, and its `_id`, `expiresAt`, `jwt` and `ttl` are `null`.

**Example:**

```ts
import { ForbiddenError, KuzzleRequest, KuzzleToken } from 'kuzzle';

app.pipe.register('document:beforeDelete', async (request: KuzzleRequest) => {
  const token: KuzzleToken | null = request.context.token;

  if (token?.type === 'apiKey') {
    throw new ForbiddenError('API keys cannot delete documents');
  }

  return request;
});
```
