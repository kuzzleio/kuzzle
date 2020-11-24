---
code: false
type: page
title: ResponsePayload
description: ResponsePayload type definition
---

# ResponsePayload

The `ResponsePayload` type represents an API response sent by Kuzzle in JSON format.

This type is returned by the [EmbeddedSDK.query](/core/2/framework/embedded-sdk/query) method.

See [API Response Format](/core/2/guides/main-concepts/1-api#response-format)

<<< ./../../../../../lib/types/ResponsePayload.ts

**Example:**

```js
import { ResponsePayload } from 'kuzzle';

const response: ResponsePayload = await app.sdk.query(/* ... */)
```