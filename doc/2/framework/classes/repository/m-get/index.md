---
code: true
type: page
title: mGet
description: Repository.mGet method
---

# `mGet()`

Gets multiple documents.

### Arguments

```js
mGet(ids: string[]): Promise<any>;
```

<br/>

| Arguments | Type                | Description                         |
| --------- | ------------------- | ----------------------------------- |
| `ids`     | <pre>string[]</pre> | List of document unique identifiers |

### Return

The `mGet` function returns a promise, resolving to the list of documents contents

If an `ObjectConstructor` argument was provided to the repository constructor, then each content is returned as an instance of that class instead of a raw object.