---
code: false
type: page
title: RequestPayload
description: RequestPayload type definition
---

# RequestPayload

<SinceBadge version="2.8.0" />

The `RequestPayload` type represents an API request sent to Kuzzle in JSON format.

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
