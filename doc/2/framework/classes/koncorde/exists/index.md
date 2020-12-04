---
code: true
type: page
title: exists
description: Koncorde.exists method
---

# `exists()`

Returns a boolean telling whether filters exist for an index-collection pair.

### Arguments

```js
exists(index: string, collection: string): boolean;
```

<br/>

| Arguments    | Type              | Description     |
| ------------ | ----------------- | --------------- |
| `index`      | <pre>string</pre> | Index name      |
| `collection` | <pre>string</pre> | Collection name |

### Return

The `exists` function returns a boolean telling whether at least one filter exists in the provided index-collection pair.
