---
code: true
type: page
title: pojo | Framework | Core

description: KuzzleRequest class pojo() method
---

# pojo

<SinceBadge version="2.19.3" />

Returns a plain JavaScript object (POJO) holding the request properties.

The `KuzzleRequest` object stores its properties under hidden keys, so it cannot be tested against a [Koncorde](/core/2/framework/classes/koncorde) filter. Its POJO can.

The returned object has the following shape:

```ts
{
  context: { connection, token, user },
  deprecations,
  error,
  id,
  input: { action, args, body, controller, jwt, volatile },
  internalId,
  response: { headers, raw },
  result,
  status,
  timestamp,
}
```

### Arguments

```ts
pojo (): JSONObject
```

</br>

### Example

```ts
const matchingFilterIds = koncorde.test(request.pojo());
```
