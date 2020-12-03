---
code: false
type: page
title: ResponsePayload
description: ResponsePayload type definition
---

# ResponsePayload

The `ResponsePayload` type represents an API response sent by Kuzzle in JSON format.

This type is returned by the SDK [query](/sdk/js/7/core-classes/kuzzle/query) method.

See the [API Response Format](/core/2/guides/main-concepts/api#response-format) documentation.

<<< ./../../../../../lib/types/ResponsePayload.ts

**Example:**

```js
import { ResponsePayload } from 'kuzzle';

const response: ResponsePayload = await app.sdk.query(/* ... */)
```
