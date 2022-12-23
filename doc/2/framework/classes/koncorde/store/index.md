---
code: true
type: page
title: store | Framework | Core

description: Koncorde.store method
---

# `store()`

Stores filters, normalized with the [Koncorde.normalize](/core/2/framework/classes/koncorde/normalize) function.

### Arguments

```js
store(normalized: JSONObject): { id: string, diff: JSONObject };
```

<br/>

| Arguments    | Type              | Description        |
| ------------ | ----------------- | ------------------ |
| `normalized` | <pre>JSONObject</pre> | Normalized filters |

### Return

The `store` function returns an object with the following attributes:

| Field  | Type              | Description                                                                                 |
| ------ | ----------------- | ------------------------------------------------------------------------------------------- |
| `id`   | <pre>string</pre> | The filter unique identifier                                                                |
| `diff` | <pre>object</pre> | If the filter didn't already exist, contains the normalized version of the provided filters |