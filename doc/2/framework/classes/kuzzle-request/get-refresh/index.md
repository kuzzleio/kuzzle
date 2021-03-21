---
code: true
type: page
title: getRefresh
description: KuzzleRequest class getRefresh() method
---

# getRefresh

<SinceBadge version="auto-version" />

Gets the refresh value.

### Arguments

```ts
getRefresh (defaultValue: string = 'false'): string
```

</br>

| Name   | Type              | Description    |
|--------|-------------------|----------------|
| `defaultValue` | <pre>string</pre> | Default value to return if the parameter is not set |


### Example

```ts
const refresh = request.getRefresh();
// equivalent
const refresh = request.input.args.refresh;
```
