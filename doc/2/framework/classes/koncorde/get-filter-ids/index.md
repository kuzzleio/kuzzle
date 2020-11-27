---
code: true
type: page
title: getFilterIds
description: Koncorde.getFilterIds method
---

# `getFilterIds()`

Retrieves the list of filter identifiers registered on an index-collection pair.

### Arguments

```js
getFilterIds(index: string, collection: string): string[];
```

<br/>

| Arguments    | Type              | Description     |
| ------------ | ----------------- | --------------- |
| `index`      | <pre>string</pre> | Index name      |
| `collection` | <pre>string</pre> | Collection name |

### Return

The `getFilterIds` function returns an array of strings, containing the exhaustive list of filter identifiers registered in the provided index-collection pair.