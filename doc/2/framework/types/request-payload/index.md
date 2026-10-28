---
code: false
type: page
title: RequestPayload | Framework | Core

description: RequestPayload type definition
---

# RequestPayload

<SinceBadge version="2.8.0" />

The `RequestPayload` type represents an API request sent to Kuzzle in JSON format.

Since 2.58.0, `RequestPayload` comes from the [kuzzle-types](https://github.com/kuzzleio/types) package, shared with the Javascript SDK: it is the same type as the one `kuzzle-sdk` exports (see [API contract types](/core/2/framework/types/api-contract-types)).

This type is meant to be used with the SDK [query](/sdk/js/7/core-classes/kuzzle/query) method.

See the [API KuzzleRequest Format](/core/2/guides/main-concepts/api#other-protocols) documentation.

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
