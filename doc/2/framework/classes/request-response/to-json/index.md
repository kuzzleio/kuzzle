---
code: true
type: page
title: toJSON | Framework | Core

description: RequestResponse class toJSON() method
---

# toJSON

<SinceBadge version="2.11.0" />

Serializes the response into the object Kuzzle sends back to the protocol.

With the `standard` format, `content` is the [response payload](/core/2/api/payloads/response). It only holds the headers set by the application (through [configure](/core/2/framework/classes/request-response/configure)), and never the `Set-Cookie` header.

```ts
{
  content: {
    action, collection, controller, deprecations, error, headers,
    index, node, requestId, result, status, volatile,
  },
  headers,
  raw: false,
  requestId,
  status,
}
```

With the `raw` format, `content` is the result itself:

```ts
{
  content: result,
  headers,
  raw: true,
  requestId,
  status,
}
```

### Arguments

```ts
toJSON (): JSONObject
```

</br>

### Example

```ts
const { status, content } = request.response.toJSON();
```
