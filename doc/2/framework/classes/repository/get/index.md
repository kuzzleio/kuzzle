---
code: true
type: page
title: get | Framework | Core

description: Repository.get method
---

# `get()`

Gets a document.

### Arguments

```js
get(id: string): Promise<any>;
```

<br/>

| Arguments | Type              | Description                |
| --------- | ----------------- | -------------------------- |
| `id`      | <pre>string</pre> | Document unique identifier |

### Return

The `get` function returns a promise, resolving to the retrieved document's content.

If an `ObjectConstructor` argument was provided to the repository constructor, then the content is returned as an instance of that class instead of a raw object.
