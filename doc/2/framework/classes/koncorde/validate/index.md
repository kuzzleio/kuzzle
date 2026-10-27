---
code: true
type: page
title: validate | Framework | Core

description: Koncorde.validate method
---

# `validate()`

<DeprecatedBadge version="2.14.0" />

Validates the provided filters without storing them.

### Arguments

```js
validate(filters: JSONObject): Promise<void>;
```

<br/>

| Arguments | Type              | Description                                     |
| --------- | ----------------- | ----------------------------------------------- |
| `filters` | <pre>JSONObject</pre> | Filters, in [Koncorde](/core/2/api/koncorde-filters-syntax) format |

### Return

The `validate` function returns a promise, which is resolved if the filters are well-formed, and rejected otherwise.
