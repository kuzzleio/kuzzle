---
code: true
type: page
title: test | Framework | Core

description: Koncorde.test method
---

# `test()`

Tests data and returns the matching filter identifiers.

### Arguments

```js
test(index: string, collection: string, data: any, documentId?: string): string[];
```

<br/>

| Arguments    | Type              | Description                |
|--------------|-------------------|----------------------------|
| `index`      | <pre>string</pre> | Index name                 |
| `collection` | <pre>string</pre> | Collection name            |
| `data`       | <pre>any</pre>    | Data to test               |
| `documentId` | <pre>string</pre> | Document unique identifier |

### Return

The `test` function returns an array of strings, which is the exhaustive list of matching filter identifiers.
