---
code: true
type: page
title: getRefresh | Framework | Core

description: KuzzleRequest class getRefresh() method
---

# getRefresh

<SinceBadge version="2.11.0" />

Gets the refresh value.

Returns `defaultValue` if the `refresh` argument is not set, `'false'` if it is `false`, `'false'` or `null`, and `'wait_for'` for any other value.

### Arguments

```ts
getRefresh (defaultValue: 'false' | 'wait_for' = 'false'): 'false' | 'wait_for'
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `defaultValue` | <pre>'false' &#124; 'wait_for'</pre> | Default value to return if the parameter is not set |


### Example

```ts
const refresh = request.getRefresh();
// equivalent
const refresh = request.input.args.refresh;
//+ checks to make sure that "refresh" is of the right type
// and throw standard API error when it's not the case
```
