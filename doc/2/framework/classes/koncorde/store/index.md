---
code: true
type: page
title: store | Framework | Core

description: Koncorde.store method
---

# `store()`

<DeprecatedBadge version="2.14.0" />

Stores filters, normalized with the [Koncorde.normalize](/core/2/framework/classes/koncorde/normalize) function.

### Arguments

```js
store(normalized: NormalizedFilterV3): Promise<{ id: string, diff: NormalizedFilterV3 | false }>;
```

<br/>

| Arguments    | Type              | Description        |
| ------------ | ----------------- | ------------------ |
| `normalized` | <pre>NormalizedFilterV3</pre> | Normalized filters, as returned by [normalize](/core/2/framework/classes/koncorde/normalize) |

### Return

The `store` function returns a promise resolving to an object with the following attributes:

| Field  | Type              | Description                                                                                 |
| ------ | ----------------- | ------------------------------------------------------------------------------------------- |
| `id`   | <pre>string</pre> | The filter unique identifier                                                                |
| `diff` | <pre>NormalizedFilterV3 \| false</pre> | If the filter didn't already exist, contains the normalized version of the provided filters. `false` if the filter was already stored |