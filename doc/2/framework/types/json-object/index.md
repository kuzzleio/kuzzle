---
code: false
type: page
title: JSONObject | Framework | Core

description: JSONObject type definition
---

# JSONObject

The `JSONObject` type represents an object with any key and any value: a JSON document, a request body, an event payload. Most framework signatures use it.

```ts
type JSONObject = Record<PropertyKey, any>;
```

Since 2.58.0, `JSONObject` comes from the [kuzzle-types](https://github.com/kuzzleio/types) package, shared with the Javascript SDK: the `JSONObject` of `kuzzle` and the one of `kuzzle-sdk` are the same type.

**Example:**

```ts
import { JSONObject } from 'kuzzle';

const body: JSONObject = {
  name: 'Aschen',
  age: 27,
};
```
