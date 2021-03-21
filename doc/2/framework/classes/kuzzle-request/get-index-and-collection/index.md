---
code: true
type: page
title: getIndexAndCollection
description: KuzzleRequest class getIndexAndCollection() method
---

# getIndexAndCollection

Returns the index and collection specified in the request.

### Arguments

```ts
getIndexAndCollection (): { index: string, collection: string }
```

</br>

### Example

```ts
const { index, collection } = request.getIndexAndCollection();
// equivalent
const { index, collection } = request.input.args;
```
