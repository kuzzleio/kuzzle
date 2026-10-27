---
code: true
type: page
title: getArrayLegacy | Framework | Core

description: KuzzleRequest class getArrayLegacy() method
---

# getArrayLegacy

<SinceBadge version="2.18.1" />
<DeprecatedBadge version="2.57.0" />

::: warning
Use [getArrayOrCsv](/core/2/framework/classes/kuzzle-request/get-array-or-csv) instead: `getArrayLegacy` is an alias of it, with the same behavior.
:::

Gets a parameter from the request arguments as an array, also accepting a comma-separated string.

### Arguments

```ts
getArrayLegacy (name: string, def?: []): any[]
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `name` | <pre>string</pre> | Parameter name |
| `def` | <pre>array</pre> | Default value to return if the parameter is not set |

### Example

```ts
// Deprecated
const ids = request.getArrayLegacy('ids');

// Equivalent
const ids = request.getArrayOrCsv('ids');
```
