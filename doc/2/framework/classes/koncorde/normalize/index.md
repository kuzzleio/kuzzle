---
code: true
type: page
title: normalize | Framework | Core

description: Koncorde.normalize method
---

# `normalize()`

Normalizes filters without storing them.

The result can be directly used with the [Koncorde.store](/core/2/framework/classes/koncorde/store) function.

### Arguments

```js
normalize(index: string, collection: string, filters: JSONObject): { collection: string, id: string, index: string, normalized: JSONObject[]};
```

<br/>

| Arguments    | Type              | Description                                     |
| ------------ | ----------------- | ----------------------------------------------- |
| `index`      | <pre>string</pre> | Index name                                      |
| `collection` | <pre>string</pre> | Collection name                                 |
| `filters`    | <pre>JSONObject</pre> | Filters, in [Koncorde](/core/2/api/koncorde-filters-syntax) format |

### Return

The `normalize` function returns a promise resolving to an object with the following properties:

| Field        | Type                | Description                                          |
| ------------ | ------------------- | ---------------------------------------------------- |
| `collection` | <pre>string</pre>   | Collection name                                      |
| `id`         | <pre>string</pre>   | The filter unique identifier                         |
| `index`      | <pre>string</pre>   | Index name                                           |
| `normalized` | <pre>JSONObject[]</pre> | Normalized/optimized version of the supplied filters |