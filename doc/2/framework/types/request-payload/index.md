---
code: false
type: page
title: RequestPayload
description: RequestPayload type definition
---

# RequestPayload

The `RequestPayload` type represents an API request sent to Kuzzle in JSON format.

This type is meant to be used with the [EmbeddedSDK.query](/core/2/framework/embedded-sdk/query) method.

See [API Request Format](/core/2/guides/main-concepts/1-api#other-protocols)

<<< ./../../../../../lib/types/RequestPayload.ts

**Example:**

```js
import { RequestPayload } from 'kuzzle';

const requestPayload: RequestPayload = {
  controller: 'document',
  action: 'create',
  index: 'nyc-open-data',
  collection: 'yellow-taxi',
  body: {
    licence: 'B'
  }
};
```