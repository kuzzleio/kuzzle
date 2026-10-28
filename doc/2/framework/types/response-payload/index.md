---
code: false
type: page
title: ResponsePayload | Framework | Core

description: ResponsePayload type definition
---

# ResponsePayload

The `ResponsePayload` type represents an API response sent by Kuzzle in JSON format.

Since 2.58.0, `ResponsePayload` comes from the [kuzzle-types](https://github.com/kuzzleio/types) package, shared with the Javascript SDK: it is the same type as the one `kuzzle-sdk` exports (see [API contract types](/core/2/framework/types/api-contract-types)).

This type is returned by the SDK [query](/sdk/js/7/core-classes/kuzzle/query) method.

See the [API Response Format](/core/2/guides/main-concepts/api#response-format) documentation.

**Example:**

```js
import { ResponsePayload } from 'kuzzle';

const response: ResponsePayload = await app.sdk.query(/* ... */)
```
