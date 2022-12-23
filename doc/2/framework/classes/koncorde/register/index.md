---
code: true
type: page
title: register | Framework | Core

description: Koncorde.register method
---

# `register()`

Registers a filter to this Koncorde instance.

This method is equivalent to executing [Koncorde.normalize](/core/2/framework/classes/koncorde/normalize) + [Koncorde.store](/core/2/framework/classes/koncorde/store).

### Arguments

```js
register(index: string, collection: string, filters: JSONObject): Promise<{ id: string, diff: JSONObject }>;
```

<br/>

| Arguments    | Type              | Description                                     |
| ------------ | ----------------- | ----------------------------------------------- |
| `index`      | <pre>string</pre> | Index name                                      |
| `collection` | <pre>string</pre> | Collection name                                 |
| `filters`    | <pre>JSONObject</pre> | Filters, in [Koncorde](/core/2/api/koncorde-filters-syntax) format |

### Return

The `register` functions returns a promise, resolving to an object with the following attributes:

| Field  | Type              | Description                                                                                                |
| ------ | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `id`   | <pre>string</pre> | The filter unique identifier                                                                               |
| `diff` | <pre>object</pre> | If the filter doesn't already exist in the engine, contains the normalized version of the provided filters |
